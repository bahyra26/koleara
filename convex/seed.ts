import { v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { isAdminRequestAuthorized } from "./lib/auth";

const SEED_BASE_TIME = Date.parse("2026-11-24T14:00:00+07:00");

const INITIAL_USERS = [
  {
    appId: "user-admin-demo",
    email: "0000000000@student.its.ac.id",
    name: "Admin KOLEARA",
    role: "admin" as const,
    nrp: "0000000000",
    department: "Tim KOLEARA ITS",
    preferredLanguage: "id" as const,
    isAdmin: true,
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-learner-demo",
    email: "0000000001@student.its.ac.id",
    name: "Bima Pratama",
    role: "learner" as const,
    nrp: "0000000001",
    cohortYear: 2026,
    department: "Teknik Informatika",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000001",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-tutor-1",
    email: "0000000101@student.its.ac.id",
    name: "Nadia Putri",
    role: "tutor" as const,
    nrp: "0000000101",
    cohortYear: 2023,
    department: "Matematika",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000101",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-tutor-2",
    email: "0000000102@student.its.ac.id",
    name: "Raka Wijaya",
    role: "tutor" as const,
    nrp: "0000000102",
    cohortYear: 2022,
    department: "Fisika",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000102",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-tutor-3",
    email: "0000000103@student.its.ac.id",
    name: "Salsa Rahmadhani",
    role: "tutor" as const,
    nrp: "0000000103",
    cohortYear: 2023,
    department: "Teknik Informatika",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000103",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-tutor-4",
    email: "0000000104@student.its.ac.id",
    name: "Dimas Santoso",
    role: "tutor" as const,
    nrp: "0000000104",
    cohortYear: 2022,
    department: "Teknik Mesin",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000104",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
  {
    appId: "user-tutor-5",
    email: "0000000105@student.its.ac.id",
    name: "Alya Kusuma",
    role: "tutor" as const,
    nrp: "0000000105",
    cohortYear: 2023,
    department: "Statistika",
    preferredLanguage: "id" as const,
    whatsapp: "6281200000105",
    onboardedAt: SEED_BASE_TIME,
    createdAt: SEED_BASE_TIME,
  },
];

// Lampiran A Brief Technical Design v2: 8 subtopik Kalkulus 1 + 8 subtopik Fisika Dasar 1
const INITIAL_COURSES = [
  {
    appId: "course-kalkulus-1",
    code: "KM234101",
    name: "Kalkulus 1",
    description:
      "Konsep dasar fungsi, limit, turunan, serta integral satu peubah untuk mahasiswa tahun pertama ITS.",
    aliases: ["Calculus 1", "Kalkulus Dasar"],
    topics: [
      "Fungsi & Grafik",
      "Limit & Kekontinuan",
      "Turunan & Aturan Rantai",
      "Turunan Implisit & Fungsi Invers",
      "Aplikasi Turunan: Maks-Min & Laju Terkait",
      "Integral Tak Tentu & Teknik Substitusi",
      "Integral Tentu & Teorema Fundamental Kalkulus",
      "Aplikasi Integral: Luas & Volume Benda Putar",
    ],
  },
  {
    appId: "course-fisika-dasar-1",
    code: "KF234101",
    name: "Fisika Dasar 1",
    description:
      "Mekanika klasik, hukum gerak Newton, energi, momentum, dinamika rotasi, hingga osilasi dan gelombang.",
    aliases: ["Fisika Mekanika", "Basic Physics 1"],
    topics: [
      "Besaran, Satuan & Vektor",
      "Kinematika 1D & 2D",
      "Dinamika: Hukum Newton & Gaya Gesek",
      "Usaha, Energi & Daya",
      "Momentum, Impuls & Tumbukan",
      "Rotasi Benda Tegar & Momen Inersia",
      "Keseimbangan Benda Tegar",
      "Osilasi & Gerak Harmonik Sederhana",
    ],
  },
];

const INITIAL_TUTORS = [
  {
    appId: "tutor-nadia",
    userId: "user-tutor-1",
    name: "Nadia Putri",
    department: "Matematika",
    cohort: 2023,
    bio: "Asisten dosen Kalkulus 1 (data contoh). Terbiasa membantu latihan soal ETS/EAS mulai dari limit hingga teknik integrasi dengan langkah terstruktur.",
    courseIds: ["course-kalkulus-1"],
    topics: [
      "Limit & Kekontinuan",
      "Turunan & Aturan Rantai",
      "Integral Tak Tentu & Teknik Substitusi",
      "Integral Tentu & Teorema Fundamental Kalkulus",
      "Aplikasi Integral: Luas & Volume Benda Putar",
    ],
    hourlyRate: 45000,
    verified: true,
    badge: "asdos" as const,
    rating: 4.9,
    reviewCount: 0,
    completedSessions: 0,
    completedSessionsDemo: 24,
    cancelledByTutorCount: 0,
    location: "hybrid" as const,
    campusSpots: ["Perpustakaan ITS", "Kantin Pusat ITS"],
    languages: ["id" as const, "en" as const],
    slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
  },
  {
    appId: "tutor-raka",
    userId: "user-tutor-2",
    name: "Raka Wijaya",
    department: "Fisika",
    cohort: 2022,
    bio: "Asisten laboratorium Fisika Dasar (data contoh). Fokus membantu pemahaman diagram gaya bebas, usaha-energi, serta soal cerita mekanika.",
    courseIds: ["course-fisika-dasar-1"],
    topics: [
      "Kinematika 1D & 2D",
      "Dinamika: Hukum Newton & Gaya Gesek",
      "Usaha, Energi & Daya",
      "Momentum, Impuls & Tumbukan",
      "Rotasi Benda Tegar & Momen Inersia",
    ],
    hourlyRate: 50000,
    verified: true,
    badge: "asdos" as const,
    rating: 4.8,
    reviewCount: 0,
    completedSessions: 0,
    completedSessionsDemo: 19,
    cancelledByTutorCount: 0,
    location: "offline" as const,
    campusSpots: ["Gedung Fisika ITS", "Perpustakaan ITS"],
    languages: ["id" as const],
    slots: ["Selasa 19:00 WIB", "Kamis 18:30 WIB", "Minggu 14:00 WIB"],
  },
  {
    appId: "tutor-salsa",
    userId: "user-tutor-3",
    name: "Salsa Rahmadhani",
    department: "Teknik Informatika",
    cohort: 2023,
    bio: "Peraih nilai A di Kalkulus 1 dan Fisika Dasar 1 (data contoh). Cocok untuk persiapan kuis mingguan dengan tarif ramah mahasiswa.",
    courseIds: ["course-kalkulus-1", "course-fisika-dasar-1"],
    topics: [
      "Limit & Kekontinuan",
      "Aplikasi Turunan: Maks-Min & Laju Terkait",
      "Integral Tentu & Teorema Fundamental Kalkulus",
      "Kinematika 1D & 2D",
      "Dinamika: Hukum Newton & Gaya Gesek",
    ],
    hourlyRate: 35000,
    verified: true,
    badge: "grade" as const,
    rating: 4.7,
    reviewCount: 0,
    completedSessions: 0,
    completedSessionsDemo: 12,
    cancelledByTutorCount: 0,
    location: "online" as const,
    campusSpots: [],
    languages: ["id" as const, "en" as const],
    slots: ["Senin 20:00 WIB", "Kamis 19:30 WIB", "Sabtu 15:00 WIB"],
  },
  {
    appId: "tutor-dimas",
    userId: "user-tutor-4",
    name: "Dimas Santoso",
    department: "Teknik Mesin",
    cohort: 2022,
    bio: "Tutor sebaya Fisika Dasar 1 dan aplikasi Kalkulus (data contoh). Menekankan intuisi fisis dan latihan soal terapan teknik.",
    courseIds: ["course-fisika-dasar-1", "course-kalkulus-1"],
    topics: [
      "Usaha, Energi & Daya",
      "Rotasi Benda Tegar & Momen Inersia",
      "Osilasi & Gerak Harmonik Sederhana",
      "Turunan & Aturan Rantai",
      "Integral Tak Tentu & Teknik Substitusi",
    ],
    hourlyRate: 60000,
    verified: true,
    badge: "grade" as const,
    rating: 4.8,
    reviewCount: 0,
    completedSessions: 0,
    completedSessionsDemo: 15,
    cancelledByTutorCount: 0,
    location: "offline" as const,
    campusSpots: ["Tower 2 ITS", "Kantin Mesin ITS"],
    languages: ["id" as const],
    slots: ["Rabu 17:00 WIB", "Jumat 19:00 WIB", "Sabtu 13:00 WIB"],
  },
  {
    appId: "tutor-alya",
    userId: "user-tutor-5",
    name: "Alya Kusuma",
    department: "Statistika",
    cohort: 2023,
    bio: "Mahasiswa Statistika ITS yang gemar membahas Kalkulus 1 secara perlahan dan sistematis (data contoh). Fokus pada integral dan aplikasi turunan.",
    courseIds: ["course-kalkulus-1"],
    topics: [
      "Fungsi & Grafik",
      "Aplikasi Turunan: Maks-Min & Laju Terkait",
      "Integral Tak Tentu & Teknik Substitusi",
      "Integral Tentu & Teorema Fundamental Kalkulus",
    ],
    hourlyRate: 40000,
    verified: true,
    badge: "grade" as const,
    rating: 4.9,
    reviewCount: 0,
    completedSessions: 0,
    completedSessionsDemo: 17,
    cancelledByTutorCount: 0,
    location: "online" as const,
    campusSpots: [],
    languages: ["id" as const, "en" as const],
    slots: ["Selasa 18:00 WIB", "Jumat 16:30 WIB", "Minggu 10:00 WIB"],
  },
];

const INITIAL_AVAILABILITY_SLOTS = [
  { appId: "slot-nadia-1", tutorId: "tutor-nadia", dayOfWeek: 1, startTime: "18:30", endTime: "19:30", isActive: true },
  { appId: "slot-nadia-2", tutorId: "tutor-nadia", dayOfWeek: 3, startTime: "19:00", endTime: "20:00", isActive: true },
  { appId: "slot-nadia-3", tutorId: "tutor-nadia", dayOfWeek: 6, startTime: "10:00", endTime: "11:00", isActive: true },
  { appId: "slot-raka-1", tutorId: "tutor-raka", dayOfWeek: 2, startTime: "19:00", endTime: "20:00", isActive: true },
  { appId: "slot-raka-2", tutorId: "tutor-raka", dayOfWeek: 4, startTime: "18:30", endTime: "19:30", isActive: true },
  { appId: "slot-raka-3", tutorId: "tutor-raka", dayOfWeek: 0, startTime: "14:00", endTime: "15:00", isActive: true },
  { appId: "slot-salsa-1", tutorId: "tutor-salsa", dayOfWeek: 1, startTime: "20:00", endTime: "21:00", isActive: true },
  { appId: "slot-salsa-2", tutorId: "tutor-salsa", dayOfWeek: 4, startTime: "19:30", endTime: "20:30", isActive: true },
  { appId: "slot-salsa-3", tutorId: "tutor-salsa", dayOfWeek: 6, startTime: "15:00", endTime: "16:00", isActive: true },
  { appId: "slot-dimas-1", tutorId: "tutor-dimas", dayOfWeek: 3, startTime: "17:00", endTime: "18:00", isActive: true },
  { appId: "slot-dimas-2", tutorId: "tutor-dimas", dayOfWeek: 5, startTime: "19:00", endTime: "20:00", isActive: true },
  { appId: "slot-dimas-3", tutorId: "tutor-dimas", dayOfWeek: 6, startTime: "13:00", endTime: "14:00", isActive: true },
  { appId: "slot-alya-1", tutorId: "tutor-alya", dayOfWeek: 2, startTime: "18:00", endTime: "19:00", isActive: true },
  { appId: "slot-alya-2", tutorId: "tutor-alya", dayOfWeek: 5, startTime: "16:30", endTime: "17:30", isActive: true },
  { appId: "slot-alya-3", tutorId: "tutor-alya", dayOfWeek: 0, startTime: "10:00", endTime: "11:00", isActive: true },
];

const INITIAL_CONVERSATIONS = [
  {
    appId: "conv-demo-seed-1",
    learnerId: "user-learner-demo",
    tutorId: "tutor-nadia",
    lastMessageAt: SEED_BASE_TIME + 5 * 60 * 1000,
  },
];

const INITIAL_MESSAGES = [
  {
    appId: "msg-seed-1",
    conversationId: "conv-demo-seed-1",
    senderId: "user-learner-demo",
    type: "text" as const,
    content:
      "Hi Nadia, could we practice Definite Integrals for next week's quiz?",
    createdAt: SEED_BASE_TIME,
    readAt: SEED_BASE_TIME + 2 * 60 * 1000,
  },
  {
    appId: "msg-seed-2",
    conversationId: "conv-demo-seed-1",
    senderId: "user-tutor-1",
    type: "text" as const,
    content:
      "Hi Bima! Of course. Let me know which time slot works best for you.",
    createdAt: SEED_BASE_TIME + 5 * 60 * 1000,
  },
];

async function clearAllTables(ctx: MutationCtx): Promise<void> {
  const tableNames = [
    "users",
    "otpChallenges",
    "sessions",
    "courses",
    "tutors",
    "availabilitySlots",
    "tutorApplications",
    "tutorPayoutAccounts",
    "conversations",
    "messages",
    "bookings",
    "payments",
    "sessionReviews",
    "payouts",
  ] as const;

  for (const table of tableNames) {
    let deleted = 0;
    for await (const doc of ctx.db.query(table)) {
      await ctx.db.delete(table, doc._id);
      deleted += 1;
      if (deleted >= 2000) break;
    }
  }
}

async function insertInitialSeedData(ctx: MutationCtx): Promise<void> {
  for (const user of INITIAL_USERS) {
    const exists = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", user.appId))
      .first();
    if (!exists) await ctx.db.insert("users", user);
  }
  for (const course of INITIAL_COURSES) {
    const exists = await ctx.db
      .query("courses")
      .withIndex("by_appId", (q) => q.eq("appId", course.appId))
      .first();
    if (!exists) await ctx.db.insert("courses", course);
  }
  for (const tutor of INITIAL_TUTORS) {
    const exists = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", tutor.appId))
      .first();
    if (!exists) await ctx.db.insert("tutors", tutor);
  }
  for (const slot of INITIAL_AVAILABILITY_SLOTS) {
    const exists = await ctx.db
      .query("availabilitySlots")
      .withIndex("by_appId", (q) => q.eq("appId", slot.appId))
      .first();
    if (!exists) await ctx.db.insert("availabilitySlots", slot);
  }
  for (const conv of INITIAL_CONVERSATIONS) {
    const exists = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", conv.appId))
      .first();
    if (!exists) await ctx.db.insert("conversations", conv);
  }
  for (const msg of INITIAL_MESSAGES) {
    const exists = await ctx.db
      .query("messages")
      .withIndex("by_appId", (q) => q.eq("appId", msg.appId))
      .first();
    if (!exists) await ctx.db.insert("messages", msg);
  }

  const existingConfig = await ctx.db
    .query("paymentConfigs")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .first();
  if (!existingConfig) {
    await ctx.db.insert("paymentConfigs", {
      key: "default",
      mode: "static_qris",
      merchantName: "KOLEARA ITS",
      qrisImageUrl: "/qris-koleara.png",
      instructions:
        "Scan QRIS KOLEARA menggunakan e-wallet atau mobile banking sesuai nominal tepat, lalu unggah bukti transfer untuk diverifikasi admin.",
      updatedAt: SEED_BASE_TIME,
    });
  }
}

export const seedDatabase = internalMutation({
  args: { forceReset: v.optional(v.boolean()) },
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx, args) => {
    const existingCourse = await ctx.db
      .query("courses")
      .withIndex("by_appId", (q) => q.eq("appId", "course-kalkulus-1"))
      .first();

    if (existingCourse && !args.forceReset) {
      return { seeded: false };
    }

    await clearAllTables(ctx);
    await insertInitialSeedData(ctx);
    return { seeded: true };
  },
});

export const ensureSeeded = mutation({
  args: {},
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx) => {
    const existingCourse = await ctx.db
      .query("courses")
      .withIndex("by_appId", (q) => q.eq("appId", "course-kalkulus-1"))
      .first();

    if (existingCourse) {
      return { seeded: false };
    }

    await insertInitialSeedData(ctx);
    return { seeded: true };
  },
});

export const resetDemoData = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.object({ reset: v.boolean() }),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
      nowMs: Date.now(),
    });
    if (!admin.authorized) {
      return { reset: false };
    }
    await clearAllTables(ctx);
    await insertInitialSeedData(ctx);
    return { reset: true };
  },
});
