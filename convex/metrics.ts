import { v } from "convex/values";
import { computePilotMetrics } from "../lib/metrics";
import { query } from "./_generated/server";
import { isAdminRequestAuthorized } from "./lib/auth";

export const getPilotMetrics = query({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.object({
    totalUsers: v.number(),
    totalLearners: v.number(),
    totalVerifiedTutors: v.number(),
    pendingTutorApplications: v.number(),
    totalConversations: v.number(),
    totalMessages: v.number(),
    totalBookings: v.number(),
    acceptedOrPaidBookings: v.number(),
    paidBookings: v.number(),
    completedBookings: v.number(),
    cancelledBookings: v.number(),
    expiredBookings: v.number(),
    acceptanceRatePercent: v.number(),
    paymentCompletionRatePercent: v.number(),
    sessionCompletionRatePercent: v.number(),
    medianTimeToAcceptMinutes: v.union(v.number(), v.null()),
    medianTimeToFirstRequestMinutes: v.union(v.number(), v.null()),
    averageTutorRating: v.number(),
    averageClarityRating: v.number(),
    averagePacingRating: v.number(),
    totalReviews: v.number(),
    totalRevenueIdr: v.number(),
    totalEscrowHeldIdr: v.number(),
    totalPaidOutIdr: v.number(),
  }),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (!admin.authorized) {
      return computePilotMetrics({
        users: [],
        verifiedTutors: [],
        pendingApplicationsCount: 0,
        conversationsCount: 0,
        messagesCount: 0,
        bookings: [],
        reviews: [],
      });
    }

    const [
      users,
      tutors,
      applications,
      conversations,
      messages,
      bookings,
      reviews,
    ] = await Promise.all([
      ctx.db.query("users").order("desc").take(500),
      ctx.db
        .query("tutors")
        .withIndex("by_verified_and_hourlyRate", (q) => q.eq("verified", true))
        .take(200),
      ctx.db
        .query("tutorApplications")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
        .take(200),
      ctx.db.query("conversations").order("desc").take(500),
      ctx.db.query("messages").order("desc").take(1000),
      ctx.db.query("bookings").order("desc").take(1000),
      ctx.db.query("sessionReviews").order("desc").take(1000),
    ]);

    return computePilotMetrics({
      users,
      verifiedTutors: tutors,
      pendingApplicationsCount: applications.length,
      conversationsCount: conversations.length,
      messagesCount: messages.length,
      bookings,
      reviews,
    });
  },
});
