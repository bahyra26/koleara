import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(v.literal("learner"), v.literal("tutor"));

export const badgeValidator = v.union(v.literal("grade"), v.literal("asdos"));

export const tutorApplicationStatusValidator = v.literal("pending");

export const messageTypeValidator = v.union(
  v.literal("text"),
  v.literal("offer"),
);

export const bookingStatusValidator = v.union(
  v.literal("offered"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("paid"),
);

export const meetingModeValidator = v.union(
  v.literal("online"),
  v.literal("offline_its"),
);

export const paymentStatusValidator = v.union(
  v.literal("unpaid"),
  v.literal("pending_verification"),
  v.literal("rejected"),
  v.literal("paid"),
);

export default defineSchema({
  users: defineTable({
    appId: v.string(),
    email: v.string(),
    name: v.string(),
    role: roleValidator,
  })
    .index("by_appId", ["appId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  courses: defineTable({
    appId: v.string(),
    code: v.string(),
    name: v.string(),
    description: v.string(),
    topics: v.array(v.string()),
  })
    .index("by_appId", ["appId"])
    .index("by_code", ["code"]),

  tutors: defineTable({
    appId: v.string(),
    userId: v.string(),
    name: v.string(),
    department: v.string(),
    cohort: v.number(),
    bio: v.string(),
    courseIds: v.array(v.string()),
    topics: v.array(v.string()),
    hourlyRate: v.number(),
    verified: v.boolean(),
    badge: v.optional(badgeValidator),
    rating: v.optional(v.number()),
    completedSessionsDemo: v.optional(v.number()),
    slots: v.array(v.string()),
  })
    .index("by_appId", ["appId"])
    .index("by_userId", ["userId"])
    .index("by_verified_and_hourlyRate", ["verified", "hourlyRate"]),

  tutorApplications: defineTable({
    appId: v.string(),
    userId: v.string(),
    name: v.string(),
    courseIds: v.array(v.string()),
    topics: v.array(v.string()),
    bio: v.string(),
    hourlyRate: v.number(),
    slots: v.array(v.string()),
    status: tutorApplicationStatusValidator,
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  conversations: defineTable({
    appId: v.string(),
    learnerId: v.string(),
    tutorId: v.string(),
    lastMessageAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_learnerId_and_tutorId", ["learnerId", "tutorId"])
    .index("by_learnerId_and_lastMessageAt", ["learnerId", "lastMessageAt"])
    .index("by_tutorId_and_lastMessageAt", ["tutorId", "lastMessageAt"]),

  messages: defineTable({
    appId: v.string(),
    conversationId: v.string(),
    senderId: v.string(),
    type: messageTypeValidator,
    content: v.optional(v.string()),
    bookingId: v.optional(v.string()),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index("by_appId", ["appId"])
    .index("by_conversationId_and_createdAt", ["conversationId", "createdAt"]),

  bookings: defineTable({
    appId: v.string(),
    conversationId: v.string(),
    learnerId: v.string(),
    tutorId: v.string(),
    courseId: v.string(),
    topic: v.string(),
    startAt: v.number(),
    durationMinutes: v.literal(60),
    price: v.number(),
    meetingMode: v.optional(meetingModeValidator),
    brief: v.optional(v.string()),
    status: bookingStatusValidator,
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_tutorId_and_startAt", ["tutorId", "startAt"])
    .index("by_learnerId_and_createdAt", ["learnerId", "createdAt"]),

  payments: defineTable({
    appId: v.string(),
    bookingId: v.string(),
    amount: v.number(),
    status: paymentStatusValidator,
    proofName: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_appId", ["appId"])
    .index("by_bookingId", ["bookingId"])
    .index("by_status", ["status"]),
});
