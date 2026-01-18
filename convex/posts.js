import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new post
export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featuredImage: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const postId = await ctx.db.insert("posts", {
      ...args,
      authorId: user._id,
      authorName: user.name,
      slug: generateSlug(args.title),
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return postId;
  },
});

// Update an existing post
export const update = mutation({
  args: {
    id: v.id("posts"),
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    featuredImage: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("published")),
    scheduledFor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const { id, ...updateData } = args;
    
    const post = await ctx.db.get(id);
    if (!post || post.authorId !== user._id) {
      throw new Error("Post not found or unauthorized");
    }

    await ctx.db.patch(id, {
      ...updateData,
      slug: generateSlug(args.title),
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Get user's draft post
export const getUserDraft = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return null;
    }
    
    const draft = await ctx.db
      .query("posts")
      .filter((q) => 
        q.and(
          q.eq(q.field("authorId"), user._id),
          q.eq(q.field("status"), "draft")
        )
      )
      .first();

    return draft;
  },
});

// Get user's posts
export const getUserPosts = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return [];
    }
    
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), user._id))
      .order("desc")
      .collect();

    return posts;
  },
});

// Get post by ID
export const getById = query({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const post = await ctx.db.get(args.id);
    if (!post || post.authorId !== user._id) {
      throw new Error("Post not found or unauthorized");
    }

    return post;
  },
});

// Delete post
export const deletePost = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const post = await ctx.db.get(args.id);
    if (!post || post.authorId !== user._id) {
      throw new Error("Post not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Helper function to generate slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}