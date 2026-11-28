import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { rankVerifiedTutors } from "./matching";
import {
  courseObjectValidator,
  isValidAppId,
  MAX_BIO_LENGTH,
  MAX_HOURLY_RATE_IDR,
  MAX_NAME_LENGTH,
  MAX_SLOT_LENGTH,
  MAX_TOPIC_LENGTH,
  serviceResultValidator,
  tutorApplicationObjectValidator,
  tutorObjectValidator,
} from "./validators";

export const listCourses = query({
  args: {},
  returns: v.array(courseObjectValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query("courses").take(50);
    return rows.map((row) => ({
      id: row.appId,
      name: row.name,
      code: row.code,
      description: row.description,
      topics: row.topics,
    }));
  },
});

export const getTopics = query({
  args: { courseId: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    if (args.courseId) {
      const courseId = args.courseId;
      const course = await ctx.db
        .query("courses")
        .withIndex("by_appId", (q) => q.eq("appId", courseId))
        .first();
      return course ? course.topics : [];
    }

    const courses = await ctx.db.query("courses").take(50);
    const seen = new Set<string>();
    const topics: string[] = [];
    for (const course of courses) {
      for (const topic of course.topics) {
        if (!seen.has(topic)) {
          seen.add(topic);
          topics.push(topic);
        }
      }
    }
    return topics;
  },
});

export const getTutorById = query({
  args: { tutorId: v.string() },
  returns: v.union(tutorObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
      .first();
    if (!row || !row.verified) return null;
    return {
      id: row.appId,
      userId: row.userId,
      name: row.name,
      department: row.department,
      cohort: row.cohort,
      bio: row.bio,
      courseIds: row.courseIds,
      topics: row.topics,
      hourlyRate: row.hourlyRate,
      verified: row.verified,
      badge: row.badge,
      rating: row.rating,
      completedSessionsDemo: row.completedSessionsDemo,
      location: row.location,
      slots: row.slots,
    };
  },
});

export const searchTutors = query({
  args: {
    query: v.optional(v.string()),
    courseId: v.optional(v.string()),
    topic: v.optional(v.string()),
    maxBudget: v.optional(v.union(v.number(), v.null())),
    scheduleQuery: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      tutor: tutorObjectValidator,
      courses: v.array(courseObjectValidator),
      matchScore: v.optional(v.number()),
      matchReasons: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const [courseRows, tutorRows] = await Promise.all([
      ctx.db.query("courses").take(50),
      ctx.db
        .query("tutors")
        .withIndex("by_verified_and_hourlyRate", (q) => q.eq("verified", true))
        .take(100),
    ]);

    const courses = courseRows.map((c) => ({
      id: c.appId,
      name: c.name,
      code: c.code,
      description: c.description,
      topics: c.topics,
    }));

    const tutors = tutorRows.map((row) => ({
      id: row.appId,
      userId: row.userId,
      name: row.name,
      department: row.department,
      cohort: row.cohort,
      bio: row.bio,
      courseIds: row.courseIds,
      topics: row.topics,
      hourlyRate: row.hourlyRate,
      verified: row.verified,
      badge: row.badge,
      rating: row.rating,
      completedSessionsDemo: row.completedSessionsDemo,
      location: row.location,
      slots: row.slots,
    }));

    return rankVerifiedTutors(tutors, courses, args);
  },
});

// shortcut: demo trusts caller-supplied userId until Convex Auth is wired
export const submitApplication = mutation({
  args: {
    appId: v.optional(v.string()),
    userId: v.string(),
    name: v.string(),
    courseIds: v.array(v.string()),
    topics: v.array(v.string()),
    bio: v.string(),
    hourlyRate: v.number(),
    slots: v.array(v.string()),
  },
  returns: serviceResultValidator(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    const trimmedName = args.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Nama lengkap wajib 2–${MAX_NAME_LENGTH} karakter.`,
      };
    }

    const uniqueCourseIds = Array.from(
      new Set(args.courseIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (uniqueCourseIds.length === 0 || uniqueCourseIds.length > 10) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pilih minimal satu mata kuliah yang valid.",
      };
    }

    const cleanTopics = Array.from(
      new Set(args.topics.map((t) => t.trim()).filter(Boolean)),
    ).slice(0, 20);
    if (
      cleanTopics.length === 0 ||
      cleanTopics.some((t) => t.length > MAX_TOPIC_LENGTH)
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pilih atau tulis minimal satu topik yang valid.",
      };
    }

    const trimmedBio = args.bio.trim();
    if (trimmedBio.length < 15 || trimmedBio.length > MAX_BIO_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Bio singkat wajib 15–${MAX_BIO_LENGTH} karakter.`,
      };
    }

    if (
      !Number.isSafeInteger(args.hourlyRate) ||
      args.hourlyRate <= 0 ||
      args.hourlyRate > MAX_HOURLY_RATE_IDR
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Tarif per 60 menit harus bilangan bulat Rp1–Rp10.000.000.",
      };
    }

    const cleanSlots = Array.from(
      new Set(args.slots.map((s) => s.trim()).filter(Boolean)),
    ).slice(0, 20);
    if (
      cleanSlots.length === 0 ||
      cleanSlots.some((s) => s.length > MAX_SLOT_LENGTH)
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Tambahkan minimal satu jadwal tersedia yang valid.",
      };
    }

    if (args.appId !== undefined && !isValidAppId(args.appId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Format ID pengajuan tidak valid.",
      };
    }

    const [user, validCourses] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", args.userId))
        .first(),
      ctx.db.query("courses").take(50),
    ]);

    if (!user) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error:
          "Silakan login demo terlebih dahulu sebelum mendaftar jadi tutor.",
      };
    }

    const validCourseIds = new Set(validCourses.map((c) => c.appId));
    if (uniqueCourseIds.some((cid) => !validCourseIds.has(cid))) {
      return {
        ok: false as const,
        code: "COURSE_NOT_FOUND",
        error: "Terdapat mata kuliah yang tidak terdaftar di katalog.",
      };
    }

    const now = Date.now();
    const appId =
      args.appId ??
      `app-tutor-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const existing = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", appId))
      .first();

    if (existing) {
      if (existing.userId !== user.appId) {
        return {
          ok: false as const,
          code: "CONFLICT",
          error: "ID pengajuan sudah digunakan.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          userId: existing.userId,
          name: existing.name,
          courseIds: existing.courseIds,
          topics: existing.topics,
          bio: existing.bio,
          hourlyRate: existing.hourlyRate,
          slots: existing.slots,
          status: existing.status,
          createdAt: existing.createdAt,
        },
      };
    }

    await ctx.db.insert("tutorApplications", {
      appId,
      userId: user.appId,
      name: trimmedName,
      courseIds: uniqueCourseIds,
      topics: cleanTopics,
      bio: trimmedBio,
      hourlyRate: args.hourlyRate,
      slots: cleanSlots,
      status: "pending",
      createdAt: now,
    });

    return {
      ok: true as const,
      data: {
        id: appId,
        userId: user.appId,
        name: trimmedName,
        courseIds: uniqueCourseIds,
        topics: cleanTopics,
        bio: trimmedBio,
        hourlyRate: args.hourlyRate,
        slots: cleanSlots,
        status: "pending" as const,
        createdAt: now,
      },
    };
  },
});

export const listApplications = query({
  args: { userId: v.string() },
  returns: v.array(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    if (!args.userId.trim()) return [];
    const rows = await ctx.db
      .query("tutorApplications")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);

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
