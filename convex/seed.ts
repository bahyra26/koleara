import { v } from "convex/values";
import { internalMutation, mutation, MutationCtx } from "./_generated/server";

const SEED_BASE_TIME = Date.parse("2026-11-24T14:00:00+07:00");

const INITIAL_USERS = [
  {
    appId: "user-learner-demo",
    email: "0000000001@student.its.ac.id",
    name: "Bima Pratama",
    role: "learner" as const,
  },
  {
    appId: "user-tutor-1",
    email: "0000000101@student.its.ac.id",
    name: "Nadia Putri",
    role: "tutor" as const,
  },
  {
    appId: "user-tutor-2",
    email: "0000000102@student.its.ac.id",
    name: "Raka Wijaya",
    role: "tutor" as const,
  },
  {
    appId: "user-tutor-3",
    email: "0000000103@student.its.ac.id",
    name: "Salsa Rahmadhani",
    role: "tutor" as const,
  },
  {
    appId: "user-tutor-4",
    email: "0000000104@student.its.ac.id",
    name: "Dimas Santoso",
    role: "tutor" as const,
  },
  {
    appId: "user-tutor-5",
    email: "0000000105@student.its.ac.id",
    name: "Alya Kusuma",
    role: "tutor" as const,
  },
];

const INITIAL_COURSES = [
  {
    appId: "course-kalkulus-1",
    code: "KM234101",
    name: "Kalkulus 1",
    description:
      "Konsep dasar fungsi, limit, turunan, serta integral satu peubah untuk mahasiswa tahun pertama ITS.",
    topics: [
      "Limit & Kekontinuan",
      "Turunan",
      "Aplikasi Turunan",
      "Integral Tak Tentu",
      "Integral Tentu",
      "Teknik Integrasi",
    ],
  },
  {
    appId: "course-fisika-dasar-1",
    code: "KF234101",
    name: "Fisika Dasar 1",
    description:
      "Mekanika klasik, hukum gerak Newton, energi, momentum, dinamika rotasi, hingga osilasi dan gelombang.",
    topics: [
      "Kinematika",
      "Hukum Newton",
      "Usaha & Energi",
      "Momentum & Tumbukan",
      "Dinamika Rotasi",
      "Osilasi & Gelombang",
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
      "Turunan",
      "Integral Tak Tentu",
      "Integral Tentu",
      "Teknik Integrasi",
    ],
    hourlyRate: 45000,
    verified: true,
    badge: "asdos" as const,
    rating: 4.9,
    completedSessionsDemo: 24,
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
      "Kinematika",
      "Hukum Newton",
      "Usaha & Energi",
      "Momentum & Tumbukan",
      "Dinamika Rotasi",
    ],
    hourlyRate: 50000,
    verified: true,
    badge: "asdos" as const,
    rating: 4.8,
    completedSessionsDemo: 19,
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
      "Aplikasi Turunan",
      "Integral Tentu",
      "Kinematika",
      "Hukum Newton",
    ],
    hourlyRate: 35000,
    verified: true,
    badge: "grade" as const,
    rating: 4.7,
    completedSessionsDemo: 12,
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
      "Usaha & Energi",
      "Dinamika Rotasi",
      "Osilasi & Gelombang",
      "Turunan",
      "Integral Tak Tentu",
    ],
    hourlyRate: 60000,
    verified: true,
    badge: "grade" as const,
    rating: 4.8,
    completedSessionsDemo: 15,
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
      "Aplikasi Turunan",
      "Integral Tak Tentu",
      "Integral Tentu",
      "Teknik Integrasi",
    ],
    hourlyRate: 40000,
    verified: true,
    badge: "grade" as const,
    rating: 4.9,
    completedSessionsDemo: 17,
    slots: ["Selasa 18:00 WIB", "Jumat 16:30 WIB", "Minggu 10:00 WIB"],
  },
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
      "Halo Kak Nadia, apakah bisa bantu bahas soal Integral Tentu untuk persiapan kuis minggu depan?",
    createdAt: SEED_BASE_TIME,
    readAt: SEED_BASE_TIME + 2 * 60 * 1000,
  },
  {
    appId: "msg-seed-2",
    conversationId: "conv-demo-seed-1",
    senderId: "user-tutor-1",
    type: "text" as const,
    content:
      "Halo Bima! Bisa banget. Kirim saja kisaran jadwal yang kosong nanti aku buatkan tawaran sesinya ya (pesan contoh demo).",
    createdAt: SEED_BASE_TIME + 5 * 60 * 1000,
  },
];

async function clearAllTables(ctx: MutationCtx): Promise<void> {
  const tableNames = [
    "users",
    "courses",
    "tutors",
    "tutorApplications",
    "conversations",
    "messages",
    "bookings",
    "payments",
  ] as const;

  for (const table of tableNames) {
    const docs = await ctx.db.query(table).take(500);
    for (const doc of docs) {
      await ctx.db.delete(table, doc._id);
    }
  }
}

async function insertInitialSeedData(ctx: MutationCtx): Promise<void> {
  for (const user of INITIAL_USERS) {
    await ctx.db.insert("users", user);
  }
  for (const course of INITIAL_COURSES) {
    await ctx.db.insert("courses", course);
  }
  for (const tutor of INITIAL_TUTORS) {
    await ctx.db.insert("tutors", tutor);
  }
  for (const conv of INITIAL_CONVERSATIONS) {
    await ctx.db.insert("conversations", conv);
  }
  for (const msg of INITIAL_MESSAGES) {
    await ctx.db.insert("messages", msg);
  }
}

export const seedDatabase = internalMutation({
  args: { forceReset: v.optional(v.boolean()) },
  returns: v.object({ seeded: v.boolean() }),
  handler: async (ctx, args) => {
    const existingCourse = await ctx.db
      .query("courses")
      .withIndex("by_appId", (q) => q.eq("appId", "course-kalkulus-1"))
      .unique();

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
      .unique();

    if (existingCourse) {
      return { seeded: false };
    }

    await insertInitialSeedData(ctx);
    return { seeded: true };
  },
});

export const resetDemoData = mutation({
  args: {},
  returns: v.object({ reset: v.boolean() }),
  handler: async (ctx) => {
    await clearAllTables(ctx);
    await insertInitialSeedData(ctx);
    return { reset: true };
  },
});
