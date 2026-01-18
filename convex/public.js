import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get published posts by username
export const getPublishedPostsByUsername = query({
  args: {
    username: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find user by name (since username isn't in schema yet)
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), args.username))
      .first();

    if (!user) {
      return { posts: [] };
    }

    const posts = await ctx.db
      .query("posts")
      .filter((q) => 
        q.and(
          q.eq(q.field("authorId"), user._id),
          q.eq(q.field("status"), "published")
        )
      )
      .order("desc")
      .take(args.limit || 20);

    return { posts };
  },
});

// Get a published post by username and post ID
export const getPublishedPost = query({
  args: {
    username: v.string(),
    postId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by name
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), args.username))
      .first();

    if (!user) {
      return null;
    }

    // Find post by slug or ID
    const post = await ctx.db
      .query("posts")
      .filter((q) => 
        q.and(
          q.eq(q.field("authorId"), user._id),
          q.eq(q.field("status"), "published"),
          q.or(
            q.eq(q.field("slug"), args.postId),
            q.eq(q.field("_id"), args.postId)
          )
        )
      )
      .first();

    return post;
  },
});

// Increment view count
export const incrementViewCount = mutation({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    await ctx.db.patch(args.postId, {
      viewCount: post.viewCount + 1,
    });

    return post.viewCount + 1;
  },
});