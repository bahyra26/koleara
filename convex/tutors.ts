import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { mapTutorDoc, resolveActorUser } from "./lib/auth";
import { rankVerifiedTutors } from "./matching";
import { languageValidator, tutorLocationValidator } from "./schema";
import {
  availabilitySlotObjectValidator,
  courseObjectValidator,
  isValidAppId,
  MAX_BIO_LENGTH,
  MAX_HOURLY_RATE_IDR,
  MAX_NAME_LENGTH,
  MAX_SLOT_LENGTH,
  MAX_TOPIC_LENGTH,
  sanitizeProofFileName,
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
      aliases: row.aliases,
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
    return await mapTutorDoc(ctx, row);
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
    language: v.optional(v.string()),
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
      aliases: c.aliases,
      topics: c.topics,
    }));

    const tutors = await Promise.all(
      tutorRows.map((row) => mapTutorDoc(ctx, row)),
    );

    return rankVerifiedTutors(tutors, courses, args);
  },
});

export const getTutorAvailabilitySlots = query({
  args: { tutorId: v.string() },
  returns: v.array(availabilitySlotObjectValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_tutorId_and_isActive", (q) =>
        q.eq("tutorId", args.tutorId).eq("isActive", true),
      )
      .take(50);

    return rows.map((row) => ({
      id: row.appId,
      tutorId: row.tutorId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isActive: row.isActive,
    }));
  },
});

export const upsertTutorAvailabilitySlots = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    slots: v.array(
      v.object({
        dayOfWeek: v.number(),
        startTime: v.string(),
        endTime: v.string(),
      }),
    ),
  },
  returns: serviceResultValidator(v.object({ count: v.number() })),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();
    if (!tutor) {
      return {
        ok: false as const,
        code: "TUTOR_NOT_FOUND",
        error: "Profil tutor tidak ditemukan untuk akun ini.",
      };
    }

    if (args.slots.length === 0 || args.slots.length > 35) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Jumlah slot aktif harus antara 1–35 slot per minggu.",
      };
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const s of args.slots) {
      if (
        !Number.isInteger(s.dayOfWeek) ||
        s.dayOfWeek < 0 ||
        s.dayOfWeek > 6 ||
        !timeRegex.test(s.startTime) ||
        !timeRegex.test(s.endTime)
      ) {
        return {
          ok: false as const,
          code: "INVALID_INPUT",
          error: "Format hari (0–6) atau jam (HH:MM) slot tidak valid.",
        };
      }
    }

    const existing = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_tutorId_and_isActive", (q) =>
        q.eq("tutorId", tutor.appId).eq("isActive", true),
      )
      .take(100);
    for (const row of existing) {
      await ctx.db.patch("availabilitySlots", row._id, { isActive: false });
    }

    const DAY_NAMES_ID = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const displaySlots: string[] = [];

    for (let i = 0; i < args.slots.length; i += 1) {
      const s = args.slots[i]!;
      await ctx.db.insert("availabilitySlots", {
        appId: `slot-${tutor.appId}-${now.toString(36)}-${i}`,
        tutorId: tutor.appId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: true,
      });
      displaySlots.push(`${DAY_NAMES_ID[s.dayOfWeek]} ${s.startTime} WIB`);
    }

    await ctx.db.patch("tutors", tutor._id, { slots: displaySlots });

    return {
      ok: true as const,
      data: { count: args.slots.length },
    };
  },
});

export const getTutorEarningsSummary = query({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      tutorId: v.string(),
      heldIdr: v.number(),
      readyForPayoutIdr: v.number(),
      paidOutIdr: v.number(),
      completedSessions: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
    });
    if (!actor) return null;

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();
    if (!tutor) return null;

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_tutorId_and_startAt", (q) => q.eq("tutorId", tutor.appId))
      .take(300);

    let heldIdr = 0;
    let readyForPayoutIdr = 0;
    let paidOutIdr = 0;
    let completedSessions = 0;

    for (const b of bookings) {
      if (b.status === "completed") completedSessions += 1;
      if (b.escrowStatus === "held") heldIdr += b.price;
      else if (b.escrowStatus === "ready_for_payout") readyForPayoutIdr += b.price;
      else if (b.escrowStatus === "paid_out") paidOutIdr += b.price;
    }

    return {
      tutorId: tutor.appId,
      heldIdr,
      readyForPayoutIdr,
      paidOutIdr,
      completedSessions,
    };
  },
});

export const submitApplication = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    appId: v.optional(v.string()),
    userId: v.string(),
    name: v.string(),
    department: v.optional(v.string()),
    cohort: v.optional(v.number()),
    courseIds: v.array(v.string()),
    topics: v.array(v.string()),
    bio: v.string(),
    hourlyRate: v.number(),
    teachingMode: v.optional(tutorLocationValidator),
    campusSpots: v.optional(v.array(v.string())),
    languages: v.optional(v.array(languageValidator)),
    slots: v.array(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    proofFileName: v.optional(v.string()),
    payoutBankOrWallet: v.optional(v.string()),
    payoutAccountName: v.optional(v.string()),
    payoutAccountNumber: v.optional(v.string()),
  },
  returns: serviceResultValidator(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.userId,
      nowMs: now,
    });

    if (!user) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Silakan login terlebih dahulu sebelum mendaftar jadi tutor.",
      };
    }

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

    if (args.proofStorageId) {
      const meta = await ctx.db.system.get("_storage", args.proofStorageId);
      if (!meta) {
        return {
          ok: false as const,
          code: "FILE_NOT_FOUND",
          error: "Berkas bukti nilai/asdos tidak ditemukan di penyimpanan.",
        };
      }
    }

    const validCourses = await ctx.db.query("courses").take(50);
    const validCourseIds = new Set(validCourses.map((c) => c.appId));
    if (uniqueCourseIds.some((cid) => !validCourseIds.has(cid))) {
      return {
        ok: false as const,
        code: "COURSE_NOT_FOUND",
        error: "Terdapat mata kuliah yang tidak terdaftar di katalog.",
      };
    }

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
          department: existing.department,
          cohort: existing.cohort,
          courseIds: existing.courseIds,
          topics: existing.topics,
          bio: existing.bio,
          hourlyRate: existing.hourlyRate,
          teachingMode: existing.teachingMode,
          campusSpots: existing.campusSpots,
          languages: existing.languages,
          slots: existing.slots,
          proofStorageId: existing.proofStorageId,
          proofFileName: existing.proofFileName,
          payoutBankOrWallet: existing.payoutBankOrWallet,
          payoutAccountName: existing.payoutAccountName,
          payoutAccountNumber: existing.payoutAccountNumber,
          status: existing.status,
          reviewedBy: existing.reviewedBy,
          reviewedAt: existing.reviewedAt,
          rejectionReason: existing.rejectionReason,
          createdAt: existing.createdAt,
        },
      };
    }

    const department = args.department?.trim() || user.department;
    const cohort = args.cohort ?? user.cohortYear;
    const proofFileName = args.proofFileName
      ? sanitizeProofFileName(args.proofFileName)
      : undefined;
    const campusSpots = args.campusSpots
      ?.map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    const languages =
      args.languages && args.languages.length > 0 ? args.languages : ["id" as const];

    await ctx.db.insert("tutorApplications", {
      appId,
      userId: user.appId,
      name: trimmedName,
      department,
      cohort,
      courseIds: uniqueCourseIds,
      topics: cleanTopics,
      bio: trimmedBio,
      hourlyRate: args.hourlyRate,
      teachingMode: args.teachingMode ?? "hybrid",
      campusSpots,
      languages,
      slots: cleanSlots,
      proofStorageId: args.proofStorageId,
      proofFileName,
      payoutBankOrWallet: args.payoutBankOrWallet?.trim() || undefined,
      payoutAccountName: args.payoutAccountName?.trim() || undefined,
      payoutAccountNumber:
        args.payoutAccountNumber?.replace(/\s+/g, "").trim() || undefined,
      status: "pending",
      createdAt: now,
    });

    const proofUrl = args.proofStorageId
      ? ((await ctx.storage.getUrl(args.proofStorageId)) ?? undefined)
      : undefined;

    return {
      ok: true as const,
      data: {
        id: appId,
        userId: user.appId,
        name: trimmedName,
        department,
        cohort,
        courseIds: uniqueCourseIds,
        topics: cleanTopics,
        bio: trimmedBio,
        hourlyRate: args.hourlyRate,
        teachingMode: args.teachingMode ?? ("hybrid" as const),
        campusSpots,
        languages,
        slots: cleanSlots,
        proofStorageId: args.proofStorageId,
        proofFileName,
        proofUrl,
        payoutBankOrWallet: args.payoutBankOrWallet?.trim() || undefined,
        payoutAccountName: args.payoutAccountName?.trim() || undefined,
        payoutAccountNumber:
          args.payoutAccountNumber?.replace(/\s+/g, "").trim() || undefined,
        status: "pending" as const,
        createdAt: now,
      },
    };
  },
});

export const listApplications = query({
  args: {
    userId: v.string(),
    sessionToken: v.optional(v.string()),
  },
  returns: v.array(tutorApplicationObjectValidator),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.userId,
    });
    if (!actor) return [];

    const rows = await ctx.db
      .query("tutorApplications")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", actor.appId))
      .order("desc")
      .take(50);

    return await Promise.all(
      rows.map(async (row) => ({
        id: row.appId,
        userId: row.userId,
        name: row.name,
        department: row.department,
        cohort: row.cohort,
        courseIds: row.courseIds,
        topics: row.topics,
        bio: row.bio,
        hourlyRate: row.hourlyRate,
        teachingMode: row.teachingMode,
        campusSpots: row.campusSpots,
        languages: row.languages,
        slots: row.slots,
        proofStorageId: row.proofStorageId,
        proofFileName: row.proofFileName,
        proofUrl: row.proofStorageId
          ? ((await ctx.storage.getUrl(row.proofStorageId)) ?? undefined)
          : undefined,
        payoutBankOrWallet: row.payoutBankOrWallet,
        payoutAccountName: row.payoutAccountName,
        payoutAccountNumber: row.payoutAccountNumber,
        status: row.status,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt,
      })),
    );
  },
});
