import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { badgeValidator } from "./schema";
import {
  paymentObjectValidator,
  serviceResultValidator,
  tutorApplicationObjectValidator,
  tutorObjectValidator,
} from "./validators";

export const listPendingApplications = query({
  args: {},
  returns: v.array(tutorApplicationObjectValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("tutorApplications")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(100);

    return rows.map((row) => ({
      id: row.appId,
      userId: row.userId,
      name: row.name,
      courseIds: row.courseIds,
      topics: row.topics,
      bio: row.bio,
      hourlyRate: row.hourlyRate,
      slots: row.slots,
      status: row.status,
      createdAt: row.createdAt,
    }));
  },
});

export const approveTutorApplication = mutation({
  args: {
    applicationId: v.string(),
    department: v.optional(v.string()),
    cohort: v.optional(v.number()),
    badge: v.optional(badgeValidator),
  },
  returns: serviceResultValidator(tutorObjectValidator),
  handler: async (ctx, args) => {
    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .unique();

    if (!application) {
      return {
        ok: false as const,
        error: "Pengajuan tutor tidak ditemukan.",
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", application.userId))
      .unique();

    if (user && user.role !== "tutor") {
      await ctx.db.patch("users", user._id, { role: "tutor" });
    }

    const existingTutor = await ctx.db
      .query("tutors")
      .withIndex("by_userId", (q) => q.eq("userId", application.userId))
      .unique();

    const tutorAppId =
      existingTutor?.appId ??
      `tutor-${application.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${Date.now().toString(36).slice(-4)}`;

    const department = (args.department ?? "Teknik Informatika").trim();
    const cohort = args.cohort ?? 2023;
    const badge = args.badge ?? "grade";

    if (existingTutor) {
      await ctx.db.patch("tutors", existingTutor._id, {
        name: application.name,
        department,
        cohort,
        bio: application.bio,
        courseIds: application.courseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        slots: application.slots,
      });
    } else {
      await ctx.db.insert("tutors", {
        appId: tutorAppId,
        userId: application.userId,
        name: application.name,
        department,
        cohort,
        bio: application.bio,
        courseIds: application.courseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        rating: undefined,
        completedSessionsDemo: 0,
        slots: application.slots,
      });
    }

    await ctx.db.delete("tutorApplications", application._id);

    return {
      ok: true as const,
      data: {
        id: tutorAppId,
        userId: application.userId,
        name: application.name,
        department,
        cohort,
        bio: application.bio,
        courseIds: application.courseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        rating: existingTutor?.rating,
        completedSessionsDemo: existingTutor?.completedSessionsDemo ?? 0,
        slots: application.slots,
      },
    };
  },
});

export const rejectTutorApplication = mutation({
  args: {
    applicationId: v.string(),
  },
  returns: v.object({ rejected: v.boolean() }),
  handler: async (ctx, args) => {
    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .unique();

    if (!application) {
      return { rejected: false };
    }

    await ctx.db.delete("tutorApplications", application._id);
    return { rejected: true };
  },
});

export const listPendingPayments = query({
  args: {},
  returns: v.array(paymentObjectValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending_verification"))
      .take(100);

    return rows.map((row) => ({
      id: row.appId,
      bookingId: row.bookingId,
      amount: row.amount,
      status: row.status,
      proofName: row.proofName,
      submittedAt: row.submittedAt,
      verifiedAt: row.verifiedAt,
      rejectionReason: row.rejectionReason,
    }));
  },
});
