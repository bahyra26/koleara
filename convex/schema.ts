import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleValidator = v.union(
  v.literal("learner"),
  v.literal("tutor"),
  v.literal("admin"),
);

export const languageValidator = v.union(v.literal("id"), v.literal("en"));

export const badgeValidator = v.union(v.literal("grade"), v.literal("asdos"));

export const tutorLocationValidator = v.union(
  v.literal("online"),
  v.literal("offline"),
  v.literal("hybrid"),
);

export const tutorApplicationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const messageTypeValidator = v.union(
  v.literal("text"),
  v.literal("offer"),
);

export const difficultyTierValidator = v.union(
  v.literal("basic"),
  v.literal("intermediate"),
  v.literal("exam_prep"),
);

export const bookingStatusValidator = v.union(
  v.literal("offered"),
  v.literal("requested"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("paid"),
  v.literal("tutor_marked_done"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("expired"),
  v.literal("disputed"),
);

export const escrowStatusValidator = v.union(
  v.literal("none"),
  v.literal("held"),
  v.literal("ready_for_payout"),
  v.literal("paid_out"),
  v.literal("refunded"),
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
  v.literal("refunded"),
);

export const paymentModeValidator = v.union(
  v.literal("static_qris"),
  v.literal("midtrans"),
);

export const payoutStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid_out"),
);

export default defineSchema({
  users: defineTable({
    appId: v.string(),
    email: v.string(),
    name: v.string(),
    role: roleValidator,
    nrp: v.optional(v.string()),
    cohortYear: v.optional(v.number()),
    department: v.optional(v.string()),
    preferredLanguage: v.optional(languageValidator),
    whatsapp: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
    avatarStorageId: v.optional(v.id("_storage")),
    onboardedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_appId", ["appId"])
    .index("by_email", ["email"])
    .index("by_nrp", ["nrp"])
    .index("by_role", ["role"]),

  otpChallenges: defineTable({
    email: v.string(),
    codeHash: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
    expiresAt: v.number(),
    attempts: v.number(),
    consumedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_email_and_createdAt", ["email", "createdAt"]),

  sessions: defineTable({
    tokenHash: v.string(),
    userId: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"]),

  courses: defineTable({
    appId: v.string(),
    code: v.string(),
    name: v.string(),
    description: v.string(),
    aliases: v.optional(v.array(v.string())),
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
    reviewCount: v.optional(v.number()),
    clarityRatingSum: v.optional(v.number()),
    pacingRatingSum: v.optional(v.number()),
    completedSessions: v.optional(v.number()),
    completedSessionsDemo: v.optional(v.number()),
    cancelledByTutorCount: v.optional(v.number()),
    location: v.optional(tutorLocationValidator),
    campusSpots: v.optional(v.array(v.string())),
    languages: v.optional(v.array(languageValidator)),
    avatarStorageId: v.optional(v.id("_storage")),
    slots: v.array(v.string()),
  })
    .index("by_appId", ["appId"])
    .index("by_userId", ["userId"])
    .index("by_verified_and_hourlyRate", ["verified", "hourlyRate"]),

  availabilitySlots: defineTable({
    appId: v.string(),
    tutorId: v.string(),
    dayOfWeek: v.number(), // 0 = Sun, 1 = Mon ... 6 = Sat
    startTime: v.string(), // "19:00"
    endTime: v.string(), // "20:00"
    isActive: v.boolean(),
  })
    .index("by_appId", ["appId"])
    .index("by_tutorId_and_isActive", ["tutorId", "isActive"]),

  tutorApplications: defineTable({
    appId: v.string(),
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
    status: tutorApplicationStatusValidator,
    reviewedBy: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  tutorPayoutAccounts: defineTable({
    tutorId: v.string(),
    userId: v.string(),
    bankOrWallet: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
    updatedAt: v.number(),
  })
    .index("by_tutorId", ["tutorId"])
    .index("by_userId", ["userId"]),

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
    sessionCount: v.optional(v.union(v.literal(1), v.literal(4))),
    price: v.number(),
    meetingMode: v.optional(meetingModeValidator),
    brief: v.optional(v.string()),
    difficultyTier: v.optional(difficultyTierValidator),
    diagnosticNotes: v.optional(v.string()),
    agreedNoJoki: v.optional(v.boolean()),
    meetingLink: v.optional(v.string()),
    status: bookingStatusValidator,
    escrowStatus: v.optional(escrowStatusValidator),
    declineReason: v.optional(v.string()),
    paymentDeadlineAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    tutorMarkedDoneAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()),
    paymentExpiryJobId: v.optional(v.id("_scheduled_functions")),
    autoCompleteJobId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_tutorId_and_startAt", ["tutorId", "startAt"])
    .index("by_tutorId_and_status", ["tutorId", "status"])
    .index("by_learnerId_and_createdAt", ["learnerId", "createdAt"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  payments: defineTable({
    appId: v.string(),
    bookingId: v.string(),
    amount: v.number(),
    status: paymentStatusValidator,
    paymentMethod: v.optional(v.string()),
    proofName: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    midtransOrderId: v.optional(v.string()),
    midtransTransactionId: v.optional(v.string()),
    midtransSnapToken: v.optional(v.string()),
    midtransRedirectUrl: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    refundedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_appId", ["appId"])
    .index("by_bookingId", ["bookingId"])
    .index("by_midtransOrderId", ["midtransOrderId"])
    .index("by_status", ["status"]),

  sessionReviews: defineTable({
    appId: v.string(),
    bookingId: v.string(),
    learnerId: v.string(),
    tutorId: v.string(),
    clarityRating: v.number(),
    pacingRating: v.number(),
    reviewText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_bookingId", ["bookingId"])
    .index("by_tutorId_and_createdAt", ["tutorId", "createdAt"]),

  payouts: defineTable({
    appId: v.string(),
    tutorId: v.string(),
    amount: v.number(),
    bookingIds: v.array(v.string()),
    status: payoutStatusValidator,
    proofStorageId: v.optional(v.id("_storage")),
    proofFileName: v.optional(v.string()),
    paidOutAt: v.optional(v.number()),
    processedBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_appId", ["appId"])
    .index("by_tutorId_and_createdAt", ["tutorId", "createdAt"])
    .index("by_status", ["status"]),

  paymentConfigs: defineTable({
    key: v.string(), // "default"
    mode: paymentModeValidator,
    merchantName: v.string(),
    qrisImageUrl: v.optional(v.string()),
    qrisStorageId: v.optional(v.id("_storage")),
    instructions: v.string(),
    accountInfo: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()),
  }).index("by_key", ["key"]),
});
