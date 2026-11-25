import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  courseObjectValidator,
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
        .unique();
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

export const listVerifiedTutors = query({
  args: {},
  returns: v.array(tutorObjectValidator),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("tutors")
      .withIndex("by_verified_and_hourlyRate", (q) => q.eq("verified", true))
      .take(100);
    return rows.map((row) => ({
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
      slots: row.slots,
    }));
  },
});

export const getTutorById = query({
  args: { tutorId: v.string() },
  returns: v.union(tutorObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
      .unique();
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

    const courseById = new Map(
      courseRows.map((c) => [
        c.appId,
        {
          id: c.appId,
          name: c.name,
          code: c.code,
          description: c.description,
          topics: c.topics,
        },
      ]),
    );

    const queryText = (args.query ?? "").trim().toLowerCase();
    const courseId = (args.courseId ?? "").trim();
    const topic = (args.topic ?? "").trim().toLowerCase();
    const maxBudget =
      typeof args.maxBudget === "number" &&
      Number.isFinite(args.maxBudget) &&
      args.maxBudget >= 0
        ? args.maxBudget
        : null;
    const scheduleQuery = (args.scheduleQuery ?? "").trim().toLowerCase();

    const hasActiveFilter = Boolean(
      queryText || courseId || topic || maxBudget !== null || scheduleQuery,
    );

    const results: Array<{
      tutor: {
        id: string;
        userId: string;
        name: string;
        department: string;
        cohort: number;
        bio: string;
        courseIds: string[];
        topics: string[];
        hourlyRate: number;
        verified: boolean;
        badge?: "grade" | "asdos";
        rating?: number;
        completedSessionsDemo?: number;
        slots: string[];
      };
      courses: Array<{
        id: string;
        name: string;
        code: string;
        description: string;
        topics: string[];
      }>;
      matchScore?: number;
      matchReasons: string[];
    }> = [];

    for (const row of tutorRows) {
      const tutor = {
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
        slots: row.slots,
      };

      const tutorCourses = tutor.courseIds
        .map((id) => courseById.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      if (courseId && !tutor.courseIds.includes(courseId)) continue;
      if (topic && !tutor.topics.some((t) => t.toLowerCase().includes(topic))) {
        continue;
      }
      if (maxBudget !== null && tutor.hourlyRate > maxBudget) continue;
      if (
        scheduleQuery &&
        !tutor.slots.some((slot) => slot.toLowerCase().includes(scheduleQuery))
      ) {
        continue;
      }

      if (queryText) {
        const haystack = [
          tutor.name,
          tutor.department,
          tutor.bio,
          ...tutorCourses.map((c) => c.name),
          ...tutor.topics,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(queryText)) continue;
      }

      if (!hasActiveFilter) {
        results.push({ tutor, courses: tutorCourses, matchReasons: [] });
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      let topicScore = 22;
      if (topic) {
        const exactTopic = tutor.topics.some((t) => t.toLowerCase() === topic);
        topicScore = exactTopic ? 40 : 32;
        reasons.push("Topik cocok");
      } else if (queryText) {
        const matchesTopic = tutor.topics.some((t) =>
          t.toLowerCase().includes(queryText),
        );
        const matchesName = tutor.name.toLowerCase().includes(queryText);
        topicScore = matchesTopic ? 38 : matchesName ? 35 : 28;
        reasons.push("Kata kunci cocok");
      } else if (courseId) {
        topicScore = 34;
        reasons.push("Mata kuliah cocok");
      }
      score += topicScore;

      const badgePts = tutor.badge === "asdos" ? 15 : 12;
      const ratingPts = Math.round(((tutor.rating ?? 4.5) / 5) * 10);
      score += Math.min(25, badgePts + ratingPts);

      if (maxBudget !== null) {
        const ratio = maxBudget > 0 ? tutor.hourlyRate / maxBudget : 1;
        score += ratio <= 0.75 ? 20 : ratio <= 0.9 ? 17 : 14;
        reasons.push("Masuk anggaran");
      } else {
        score += tutor.hourlyRate <= 45000 ? 18 : 14;
      }

      if (scheduleQuery) {
        score += 15;
        reasons.push("Jadwal cocok");
      } else {
        score += tutor.slots.length >= 3 ? 13 : 10;
      }

      results.push({
        tutor,
        courses: tutorCourses,
        matchScore: Math.min(100, Math.max(1, score)),
        matchReasons: reasons,
      });
    }

    if (hasActiveFilter) {
      results.sort((a, b) => {
        const scoreDiff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        return scoreDiff !== 0
          ? scoreDiff
          : a.tutor.hourlyRate - b.tutor.hourlyRate;
      });
    } else {
      results.sort((a, b) => a.tutor.name.localeCompare(b.tutor.name, "id"));
    }

    return results;
  },
});

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
    if (trimmedName.length < 2) {
      return { ok: false as const, error: "Nama lengkap minimal 2 karakter." };
    }
    if (args.courseIds.length === 0) {
      return {
        ok: false as const,
        error: "Pilih minimal satu mata kuliah.",
      };
    }
    const cleanTopics = args.topics.map((t) => t.trim()).filter(Boolean);
    if (cleanTopics.length === 0) {
      return {
        ok: false as const,
        error: "Pilih atau tulis minimal satu topik.",
      };
    }
    const trimmedBio = args.bio.trim();
    if (trimmedBio.length < 15) {
      return { ok: false as const, error: "Bio singkat minimal 15 karakter." };
    }
    if (!Number.isSafeInteger(args.hourlyRate) || args.hourlyRate <= 0) {
      return {
        ok: false as const,
        error: "Tarif per 60 menit harus lebih dari Rp0.",
      };
    }
    const cleanSlots = args.slots.map((s) => s.trim()).filter(Boolean);
    if (cleanSlots.length === 0) {
      return {
        ok: false as const,
        error: "Tambahkan minimal satu jadwal tersedia.",
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", args.userId))
      .unique();
    if (!user) {
      return {
        ok: false as const,
        error:
          "Silakan login demo terlebih dahulu sebelum mendaftar jadi tutor.",
      };
    }

    const now = Date.now();
    const appId =
      args.appId ??
      `app-tutor-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const existing = await ctx.db
      .query("tutorApplications")
      .withIndex("by_appId", (q) => q.eq("appId", appId))
      .unique();

    if (existing) {
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
      courseIds: args.courseIds,
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
        courseIds: args.courseIds,
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
