import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Toggle follow/unfollow
export const toggleFollow = mutation({
  args: { followingId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("Must be logged in to follow users");
    }
    
    if (user._id === args.followingId) {
      throw new Error("Cannot follow yourself");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query("follows")
      .filter((q) => 
        q.and(
          q.eq(q.field("followerId"), user._id),
          q.eq(q.field("followingId"), args.followingId)
        )
      )
      .first();

    if (existingFollow) {
      // Unfollow
      await ctx.db.delete(existingFollow._id);
      return { action: "unfollowed" };
    } else {
      // Follow
      await ctx.db.insert("follows", {
        followerId: user._id,
        followingId: args.followingId,
        createdAt: Date.now(),
      });
      return { action: "followed" };
    }
  },
});

// Check if current user is following someone
export const isFollowing = query({
  args: { followingId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return false;
    }
    
    const follow = await ctx.db
      .query("follows")
      .filter((q) => 
        q.and(
          q.eq(q.field("followerId"), user._id),
          q.eq(q.field("followingId"), args.followingId)
        )
      )
      .first();

    return !!follow;
  },
});

// Get follower count for a user
export const getFollowerCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followingId"), args.userId))
      .collect();

    return follows.length;
  },
});

// Get current user's followers
export const getMyFollowers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return [];
    }
    
    const follows = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followingId"), user._id))
      .order("desc")
      .take(args.limit || 50);

    // Get follower user details
    const followers = await Promise.all(
      follows.map(async (follow) => {
        const follower = await ctx.db.get(follow.followerId);
        return {
          ...follower,
          followedAt: follow.createdAt,
        };
      })
    );

    return followers;
  },
});

// Get users current user is following
export const getMyFollowing = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      return [];
    }
    
    const follows = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followerId"), user._id))
      .order("desc")
      .take(args.limit || 50);

    // Get following user details
    const following = await Promise.all(
      follows.map(async (follow) => {
        const followedUser = await ctx.db.get(follow.followingId);
        return {
          ...followedUser,
          followedAt: follow.createdAt,
        };
      })
    );

    return following;
  },
});