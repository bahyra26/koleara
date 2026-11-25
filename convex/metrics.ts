import { v } from "convex/values";
import { query } from "./_generated/server";
import { isAdminAuthorized } from "./validators";

/**
 * Ekstraksi Metrik Pilot (Bab 6.1 Technical Design Brief - Issue K-23)
 * Menghitung metrik pilot secara otomatis dari database Convex:
 * - Tingkat penerimaan (accepted + paid / seluruh tawaran)
 * - Penyelesaian pembayaran (paid / (accepted + paid))
 * - Jumlah tutor terverifikasi & pengajuan pending
 * - Rata-rata rating tutor
 */
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
      return {
        totalUsers: 0,
        totalLearners: 0,
        totalVerifiedTutors: 0,
        pendingTutorApplications: 0,
        totalConversations: 0,
        totalMessages: 0,
        totalBookings: 0,
        acceptedOrPaidBookings: 0,
        paidBookings: 0,
        acceptanceRatePercent: 0,
        paymentCompletionRatePercent: 0,
        averageTutorRating: 0,
        totalRevenueIdr: 0,
      };
    }

    const [
      users,
      tutors,
      applications,
      conversations,
      messages,
      bookings,
      payments,
    ] = await Promise.all([
      ctx.db.query("users").order("desc").take(200),
      ctx.db
        .query("tutors")
        .withIndex("by_verified_and_hourlyRate", (q) => q.eq("verified", true))
        .take(200),
      ctx.db
        .query("tutorApplications")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
        .take(200),
      ctx.db.query("conversations").order("desc").take(200),
      ctx.db.query("messages").order("desc").take(500),
      ctx.db.query("bookings").order("desc").take(300),
      ctx.db
        .query("payments")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .order("desc")
        .take(300),
    ]);

    const totalLearners = users.filter((u) => u.role === "learner").length;
    const totalBookings = bookings.length;
    const acceptedOrPaidBookings = bookings.filter(
      (b) => b.status === "accepted" || b.status === "paid",
    ).length;
    const paidBookings = bookings.filter((b) => b.status === "paid").length;

    const acceptanceRatePercent =
      totalBookings > 0
        ? Math.round((acceptedOrPaidBookings / totalBookings) * 1000) / 10
        : 0;

    const paymentCompletionRatePercent =
      acceptedOrPaidBookings > 0
        ? Math.round((paidBookings / acceptedOrPaidBookings) * 1000) / 10
        : 0;

    const ratedTutors = tutors.filter((t) => typeof t.rating === "number");
    const averageTutorRating =
      ratedTutors.length > 0
        ? Math.round(
            (ratedTutors.reduce((acc, t) => acc + (t.rating ?? 0), 0) /
              ratedTutors.length) *
              100,
          ) / 100
        : 0;

    const totalRevenueIdr = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalUsers: users.length,
      totalLearners,
      totalVerifiedTutors: tutors.length,
      pendingTutorApplications: applications.length,
      totalConversations: conversations.length,
      totalMessages: messages.length,
      totalBookings,
      acceptedOrPaidBookings,
      paidBookings,
      acceptanceRatePercent,
      paymentCompletionRatePercent,
      averageTutorRating,
      totalRevenueIdr,
    };
  },
});
