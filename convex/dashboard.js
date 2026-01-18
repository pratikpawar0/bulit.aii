import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get analytics for user's blog dashboard
export const getAnalytics = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get all user's posts
    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), user._id))
      .collect();

    const publishedPosts = posts.filter(p => p.status === "published");
    const draftPosts = posts.filter(p => p.status === "draft");

    // Calculate totals
    const totalViews = publishedPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
    const totalLikes = publishedPosts.reduce((sum, post) => sum + (post.likeCount || 0), 0);
    const totalComments = publishedPosts.reduce((sum, post) => sum + (post.commentCount || 0), 0);

    // Get follower count
    const followers = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followingId"), user._id))
      .collect();

    return {
      totalPosts: publishedPosts.length,
      totalDrafts: draftPosts.length,
      totalViews,
      totalLikes,
      totalComments,
      totalFollowers: followers.length,
    };
  },
});

// Get posts with analytics for dashboard
export const getPostsWithAnalytics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }

    const limit = args.limit || 10;

    const posts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), user._id))
      .order("desc")
      .take(limit);

    return posts;
  },
});

// Get recent activity for dashboard
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }

    const limit = args.limit || 10;
    const activities = [];

    // Get recent comments on user's posts
    const userPosts = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("authorId"), user._id))
      .collect();

    const postIds = userPosts.map(p => p._id);

    if (postIds.length > 0) {
      const recentComments = await ctx.db
        .query("comments")
        .filter((q) => q.or(...postIds.map(id => q.eq(q.field("postId"), id))))
        .order("desc")
        .take(limit);

      for (const comment of recentComments) {
        const post = userPosts.find(p => p._id === comment.postId);
        activities.push({
          type: "comment",
          message: `${comment.authorName} commented on "${post?.title}"`,
          timestamp: comment.createdAt,
          data: { comment, post },
        });
      }
    }

    // Get recent follows
    const recentFollows = await ctx.db
      .query("follows")
      .filter((q) => q.eq(q.field("followingId"), user._id))
      .order("desc")
      .take(5);

    for (const follow of recentFollows) {
      const follower = await ctx.db.get(follow.followerId);
      if (follower) {
        activities.push({
          type: "follow",
          message: `${follower.name} started following you`,
          timestamp: follow.createdAt,
          data: { follower },
        });
      }
    }

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

// Get daily views data for chart
export const getDailyViews = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Get posts from last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const posts = await ctx.db
      .query("posts")
      .filter((q) => 
        q.and(
          q.eq(q.field("authorId"), user._id),
          q.gte(q.field("createdAt"), thirtyDaysAgo)
        )
      )
      .collect();

    // Group by day (simplified - in real app you'd want more sophisticated tracking)
    const dailyData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Simulate daily views (in real app, you'd track this properly)
      const dayPosts = posts.filter(p => {
        const postDate = new Date(p.createdAt);
        return postDate.toDateString() === date.toDateString();
      });
      
      const views = dayPosts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
      
      dailyData.push({
        day: dayName,
        views: Math.max(views, Math.floor(Math.random() * 100)), // Add some randomness for demo
      });
    }

    return dailyData;
  },
});

// Get event with detailed stats for dashboard (existing function)
export const getEventDashboard = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    if (!user) {
      throw new Error("User not found");
    }

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if user is the organizer
    if (event.organizerId !== user._id) {
      throw new Error("You are not authorized to view this dashboard");
    }

    // Get all registrations
    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Calculate stats
    const totalRegistrations = registrations.filter(
      (r) => r.status === "confirmed"
    ).length;
    const checkedInCount = registrations.filter(
      (r) => r.checkedIn && r.status === "confirmed"
    ).length;
    const pendingCount = totalRegistrations - checkedInCount;

    // Calculate revenue for paid events
    let totalRevenue = 0;
    if (event.ticketType === "paid" && event.ticketPrice) {
      totalRevenue = checkedInCount * event.ticketPrice;
    }

    // Calculate check-in rate
    const checkInRate =
      totalRegistrations > 0
        ? Math.round((checkedInCount / totalRegistrations) * 100)
        : 0;

    // Calculate time until event
    const now = Date.now();
    const timeUntilEvent = event.startDate - now;
    const hoursUntilEvent = Math.max(
      0,
      Math.floor(timeUntilEvent / (1000 * 60 * 60))
    );

    const today = new Date().setHours(0, 0, 0, 0);
    const startDay = new Date(event.startDate).setHours(0, 0, 0, 0);
    const endDay = new Date(event.endDate).setHours(0, 0, 0, 0);
    const isEventToday = today >= startDay && today <= endDay;
    const isEventPast = event.endDate < now;

    return {
      event,
      stats: {
        totalRegistrations,
        checkedInCount,
        pendingCount,
        capacity: event.capacity,
        checkInRate,
        totalRevenue,
        hoursUntilEvent,
        isEventToday,
        isEventPast,
      },
    };
  },
});
