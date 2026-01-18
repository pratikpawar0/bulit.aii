import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Toggle like/unlike on a post
export const toggleLike = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("Must be logged in to like posts");
    }

    // Check if user already liked this post
    const existingLike = await ctx.db
      .query("likes")
      .filter((q) => 
        q.and(
          q.eq(q.field("postId"), args.postId),
          q.eq(q.field("userId"), user._id)
        )
      )
      .first();

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    if (existingLike) {
      // Unlike - remove the like
      await ctx.db.delete(existingLike._id);
      
      // Update post like count
      await ctx.db.patch(args.postId, {
        likeCount: Math.max(0, post.likeCount - 1),
      });

      return { action: "unliked", likeCount: Math.max(0, post.likeCount - 1) };
    } else {
      // Like - add the like
      await ctx.db.insert("likes", {
        postId: args.postId,
        userId: user._id,
        createdAt: Date.now(),
      });

      // Update post like count
      const newLikeCount = post.likeCount + 1;
      await ctx.db.patch(args.postId, {
        likeCount: newLikeCount,
      });

      return { action: "liked", likeCount: newLikeCount };
    }
  },
});

// Check if current user has liked a post
export const hasUserLiked = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return false;
    }

    const like = await ctx.db
      .query("likes")
      .filter((q) => 
        q.and(
          q.eq(q.field("postId"), args.postId),
          q.eq(q.field("userId"), user._id)
        )
      )
      .first();

    return !!like;
  },
});

// Get users who liked a post
export const getPostLikes = query({
  args: { 
    postId: v.id("posts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const likes = await ctx.db
      .query("likes")
      .filter((q) => q.eq(q.field("postId"), args.postId))
      .order("desc")
      .take(limit);

    // Get user details for each like
    const likesWithUsers = await Promise.all(
      likes.map(async (like) => {
        const user = await ctx.db.get(like.userId);
        return {
          ...like,
          user: user ? {
            _id: user._id,
            name: user.name,
            imageUrl: user.imageUrl,
          } : null,
        };
      })
    );

    return likesWithUsers.filter(like => like.user !== null);
  },
});