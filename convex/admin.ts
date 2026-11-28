import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { badgeValidator } from "./schema";
import {
  isAdminAuthorized,
  paymentObjectValidator,
  serviceResultValidator,
  tutorApplicationObjectValidator,
  tutorObjectValidator,
} from "./validators";

export const listPendingApplications = query({
  args: { adminKey: v.optional(v.string()) },
  returns: v.array(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) return [];
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
    adminKey: v.optional(v.string()),
  },
  returns: serviceResultValidator(tutorObjectValidator),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Akses admin tidak valid.",
      };
    }

    if (
      args.cohort !== undefined &&
      (!Number.isInteger(args.cohort) || args.cohort < 2000 || args.cohort > 2035)
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Angkatan (cohort) harus berupa tahun bulat antara 2000–2035.",
      };
    }

    const rawDept = (args.department ?? "Teknik Informatika").trim();
    if (rawDept.length < 2 || rawDept.length > 80) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama departemen wajib 2–80 karakter.",
      };
    }

    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .first();

    if (!application) {
      return {
        ok: false as const,
        code: "NOT_FOUND",
        error: "Pengajuan tutor tidak ditemukan.",
      };
    }

    const [user, existingTutor, courses] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", application.userId))
        .first(),
      ctx.db
        .query("tutors")
        .withIndex("by_userId", (q) => q.eq("userId", application.userId))
        .first(),
      ctx.db.query("courses").take(50),
    ]);

    const validCourseIds = new Set(courses.map((c) => c.appId));
    const filteredCourseIds = application.courseIds.filter((cid) =>
      validCourseIds.has(cid),
    );
    if (filteredCourseIds.length === 0) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pengajuan tidak memiliki mata kuliah aktif yang valid.",
      };
    }

    if (user && user.role !== "tutor") {
      await ctx.db.patch("users", user._id, { role: "tutor" });
    }

    const nameSlug =
      application.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "kandidat";

    const tutorAppId =
      existingTutor?.appId ??
      `tutor-${nameSlug}-${Date.now().toString(36).slice(-4)}`;

    const cohort = args.cohort ?? 2023;
    const badge = args.badge ?? "grade";

    if (existingTutor) {
      await ctx.db.patch("tutors", existingTutor._id, {
        name: application.name,
        department: rawDept,
        cohort,
        bio: application.bio,
        courseIds: filteredCourseIds,
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
        department: rawDept,
        cohort,
        bio: application.bio,
        courseIds: filteredCourseIds,
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
        department: rawDept,
        cohort,
        bio: application.bio,
        courseIds: filteredCourseIds,
        topics: application.topics,
        hourlyRate: application.hourlyRate,
        verified: true,
        badge,
        rating: existingTutor?.rating,
        completedSessionsDemo: existingTutor?.completedSessionsDemo ?? 0,
        location: existingTutor?.location,
        slots: application.slots,
      },
    };
  },
});

export const rejectTutorApplication = mutation({
  args: {
    applicationId: v.string(),
    adminKey: v.optional(v.string()),
  },
  returns: v.object({
    rejected: v.boolean(),
    unauthorized: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) {
      return { rejected: false, unauthorized: true };
    }

    const application = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", args.applicationId))
      .first();

    if (!application) {
      return { rejected: false };
    }

    await ctx.db.delete("tutorApplications", application._id);
    return { rejected: true };
  },
});

export const listPendingPayments = query({
  args: { adminKey: v.optional(v.string()) },
  returns: v.array(paymentObjectValidator),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) return [];
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_status", (q) => q.eq("status", "pending_verification"))
      .order("desc")
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
