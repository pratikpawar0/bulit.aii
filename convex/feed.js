import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { v } from "convex/values";

// Get personalized feed for current user
export const getFeed = query({
  args: { 
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    
    try {
      const user = await ctx.runQuery(internal.users.getCurrentUser);
      
      if (!user) {
        // If no user, return public posts
        const posts = await ctx.db
          .query("posts")
          .filter((q) => q.eq(q.field("status"), "published"))
          .order("desc")
          .take(limit);

        return {
          posts: posts || [],
          hasMore: posts.length === limit,
        };
      }

      // Get users that current user follows
      const following = await ctx.db
        .query("follows")
        .filter((q) => q.eq(q.field("followerId"), user._id))
        .collect();

      const followingIds = following.map(f => f.followingId);
      
      // If not following anyone, show recent public posts
      if (followingIds.length === 0) {
        const posts = await ctx.db
          .query("posts")
          .filter((q) => q.eq(q.field("status"), "published"))
          .order("desc")
          .take(limit);

        return {
          posts: posts || [],
          hasMore: posts.length === limit,
        };
      }

      // Get posts from followed users
      const posts = await ctx.db
        .query("posts")
        .filter((q) => 
          q.and(
            q.eq(q.field("status"), "published"),
            q.or(...followingIds.map(id => q.eq(q.field("authorId"), id)))
          )
        )
        .order("desc")
        .take(limit);

      return {
        posts: posts || [],
        hasMore: posts.length === limit,
      };
    } catch (error) {
      console.error("Error in getFeed:", error);
      // Fallback to public posts
      const posts = await ctx.db
        .query("posts")
        .filter((q) => q.eq(q.field("status"), "published"))
        .order("desc")
        .take(limit);

      return {
        posts: posts || [],
        hasMore: posts.length === limit,
      };
    }
  },
});

// Get trending posts (most viewed/liked recently)
export const getTrendingPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    
    // Get posts from the last 7 days, sorted by engagement
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const posts = await ctx.db
      .query("posts")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "published"),
          q.gte(q.field("createdAt"), sevenDaysAgo)
        )
      )
      .collect();

    // Sort by engagement score (views + likes * 2 + comments * 3)
    const sortedPosts = posts
      .map(post => ({
        ...post,
        engagementScore: (post.viewCount || 0) + 
                        (post.likeCount || 0) * 2 + 
                        (post.commentCount || 0) * 3
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);

    return sortedPosts;
  },
});

// Get suggested users to follow
export const getSuggestedUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 6;
    
    try {
      const user = await ctx.runQuery(internal.users.getCurrentUser);
      
      if (!user) {
        // If no user, return most active users
        const users = await ctx.db
          .query("users")
          .order("desc")
          .take(limit);

        return await Promise.all(
          users.map(async (u) => {
            const postCount = await getPostCount(ctx, u._id);
            const followerCount = await getFollowerCount(ctx, u._id);
            
            return {
              ...u,
              username: u.name, // Using name as username for now
              postCount,
              followerCount,
              recentPosts: [],
            };
          })
        );
      }

      // Get users current user is already following
      const following = await ctx.db
        .query("follows")
        .filter((q) => q.eq(q.field("followerId"), user._id))
        .collect();

      const followingIds = following.map(f => f.followingId);
      followingIds.push(user._id); // Don't suggest self

      // Get users not being followed, with recent activity
      const allUsers = await ctx.db
        .query("users")
        .filter((q) => q.neq(q.field("_id"), user._id))
        .collect();

      const suggestedUsers = allUsers
        .filter(u => !followingIds.includes(u._id))
        .slice(0, limit * 2); // Get more to filter from

      // Add engagement data and sort
      const usersWithData = await Promise.all(
        suggestedUsers.map(async (u) => {
          const postCount = await getPostCount(ctx, u._id);
          const followerCount = await getFollowerCount(ctx, u._id);
          const recentPosts = await getRecentPosts(ctx, u._id, 1);
          
          return {
            ...u,
            username: u.name, // Using name as username for now
            postCount,
            followerCount,
            recentPosts,
            activityScore: postCount + followerCount,
          };
        })
      );

      // Sort by activity and return top suggestions
      return usersWithData
        .sort((a, b) => b.activityScore - a.activityScore)
        .slice(0, limit);

    } catch (error) {
      console.error("Error in getSuggestedUsers:", error);
      return [];
    }
  },
});

// Helper functions
async function getPostCount(ctx, userId) {
  const posts = await ctx.db
    .query("posts")
    .filter((q) => 
      q.and(
        q.eq(q.field("authorId"), userId),
        q.eq(q.field("status"), "published")
      )
    )
    .collect();
  
  return posts.length;
}

async function getFollowerCount(ctx, userId) {
  const followers = await ctx.db
    .query("follows")
    .filter((q) => q.eq(q.field("followingId"), userId))
    .collect();
  
  return followers.length;
}

async function getRecentPosts(ctx, userId, limit = 1) {
  const posts = await ctx.db
    .query("posts")
    .filter((q) => 
      q.and(
        q.eq(q.field("authorId"), userId),
        q.eq(q.field("status"), "published")
      )
    )
    .order("desc")
    .take(limit);
  
  return posts;
}