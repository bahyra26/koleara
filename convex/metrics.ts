import { v } from "convex/values";
import { computePilotMetrics } from "../lib/metrics";
import { query } from "./_generated/server";
import { isAdminAuthorized } from "./validators";

export const getPilotMetrics = query({
  args: { adminKey: v.optional(v.string()) },
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
    acceptanceRatePercent: v.number(),
    paymentCompletionRatePercent: v.number(),
    averageTutorRating: v.number(),
    totalRevenueIdr: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) {
      return computePilotMetrics({
        users: [],
        verifiedTutors: [],
        pendingApplicationsCount: 0,
        conversationsCount: 0,
        messagesCount: 0,
        bookings: [],
      });
    }

    const [
      users,
      tutors,
      applications,
      conversations,
      messages,
      bookings,
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
    ]);

    return computePilotMetrics({
      users,
      verifiedTutors: tutors,
      pendingApplicationsCount: applications.length,
      conversationsCount: conversations.length,
      messagesCount: messages.length,
      bookings,
    });
  },
});
