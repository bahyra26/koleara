import { v } from "convex/values";
import {
  badgeValidator,
  bookingStatusValidator,
  difficultyTierValidator,
  escrowStatusValidator,
  languageValidator,
  meetingModeValidator,
  messageTypeValidator,
  paymentModeValidator,
  paymentStatusValidator,
  payoutStatusValidator,
  roleValidator,
  tutorApplicationStatusValidator,
  tutorLocationValidator,
} from "./schema";

export const userObjectValidator = v.object({
  id: v.string(),
  email: v.string(),
  name: v.string(),
  role: roleValidator,
  nrp: v.optional(v.string()),
  cohortYear: v.optional(v.number()),
  department: v.optional(v.string()),
  preferredLanguage: v.optional(languageValidator),
  whatsapp: v.optional(v.string()),
  isAdmin: v.optional(v.boolean()),
  avatarUrl: v.optional(v.string()),
  onboardedAt: v.optional(v.number()),
  createdAt: v.optional(v.number()),
});

export const courseObjectValidator = v.object({
  id: v.string(),
  name: v.string(),
  code: v.string(),
  description: v.string(),
  aliases: v.optional(v.array(v.string())),
  topics: v.array(v.string()),
});

export const tutorObjectValidator = v.object({
  id: v.string(),
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
  clarityRatingAvg: v.optional(v.number()),
  pacingRatingAvg: v.optional(v.number()),
  completedSessions: v.optional(v.number()),
  completedSessionsDemo: v.optional(v.number()),
  cancelledByTutorCount: v.optional(v.number()),
  location: v.optional(tutorLocationValidator),
  campusSpots: v.optional(v.array(v.string())),
  languages: v.optional(v.array(languageValidator)),
  avatarUrl: v.optional(v.string()),
  slots: v.array(v.string()),
});

export const availabilitySlotObjectValidator = v.object({
  id: v.string(),
  tutorId: v.string(),
  dayOfWeek: v.number(),
  startTime: v.string(),
  endTime: v.string(),
  isActive: v.boolean(),
});

export const tutorApplicationObjectValidator = v.object({
  id: v.string(),
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
  proofUrl: v.optional(v.string()),
  payoutBankOrWallet: v.optional(v.string()),
  payoutAccountName: v.optional(v.string()),
  payoutAccountNumber: v.optional(v.string()),
  status: tutorApplicationStatusValidator,
  reviewedBy: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),
  createdAt: v.number(),
});

export const tutorPayoutAccountObjectValidator = v.object({
  tutorId: v.string(),
  userId: v.string(),
  bankOrWallet: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  updatedAt: v.number(),
});

export const conversationObjectValidator = v.object({
  id: v.string(),
  learnerId: v.string(),
  tutorId: v.string(),
  lastMessageAt: v.number(),
});

export const messageObjectValidator = v.object({
  id: v.string(),
  conversationId: v.string(),
  senderId: v.string(),
  type: messageTypeValidator,
  content: v.optional(v.string()),
  bookingId: v.optional(v.string()),
  createdAt: v.number(),
  readAt: v.optional(v.number()),
});

export const bookingObjectValidator = v.object({
  id: v.string(),
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
  createdAt: v.number(),
});

export const paymentObjectValidator = v.object({
  id: v.string(),
  bookingId: v.string(),
  amount: v.number(),
  status: paymentStatusValidator,
  paymentMethod: v.optional(v.string()),
  proofName: v.optional(v.string()),
  proofStorageId: v.optional(v.id("_storage")),
  proofUrl: v.optional(v.string()),
  midtransOrderId: v.optional(v.string()),
  midtransTransactionId: v.optional(v.string()),
  midtransSnapToken: v.optional(v.string()),
  midtransRedirectUrl: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
  refundedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),
});

export const sessionReviewObjectValidator = v.object({
  id: v.string(),
  bookingId: v.string(),
  learnerId: v.string(),
  tutorId: v.string(),
  clarityRating: v.number(),
  pacingRating: v.number(),
  reviewText: v.optional(v.string()),
  createdAt: v.number(),
});

export const payoutObjectValidator = v.object({
  id: v.string(),
  tutorId: v.string(),
  amount: v.number(),
  bookingIds: v.array(v.string()),
  status: payoutStatusValidator,
  proofStorageId: v.optional(v.id("_storage")),
  proofFileName: v.optional(v.string()),
  proofUrl: v.optional(v.string()),
  paidOutAt: v.optional(v.number()),
  processedBy: v.optional(v.string()),
  createdAt: v.number(),
});

export const paymentConfigObjectValidator = v.object({
  mode: paymentModeValidator,
  merchantName: v.string(),
  qrisImageUrl: v.optional(v.string()),
  instructions: v.string(),
  accountInfo: v.optional(v.string()),
  midtransEnabled: v.boolean(),
  updatedAt: v.number(),
});

export function serviceResultValidator<T extends ReturnType<typeof v.object>>(
  dataValidator: T,
) {
  return v.union(
    v.object({
      ok: v.literal(true),
      data: dataValidator,
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      code: v.optional(v.string()),
    }),
  );
}

export {
  constantTimeStringEqual,
  DEMO_OTP_CODE,
  evaluateCancellationRefund,
  extractCohortYearFromNrp,
  extractNrpFromItsEmail,
  ITS_STUDENT_EMAIL_REGEX,
  MAX_BIO_LENGTH,
  MAX_BRIEF_LENGTH,
  MAX_HOURLY_RATE_IDR,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_SLOT_LENGTH,
  MAX_TOPIC_LENGTH,
  normalizeItsEmail,
  sanitizeProofFileName,
  validateWhatsappNumber,
} from "../lib/validators";

export const SAFE_APP_ID_REGEX = /^[a-zA-Z0-9_-]{3,80}$/;

export function isValidAppId(value: string): boolean {
  return SAFE_APP_ID_REGEX.test(value);
}

export function isAdminAuthorized(
  providedKey?: string,
  expectedKey?: string,
): boolean {
  const expected = (expectedKey ?? process.env.KOLEARA_ADMIN_KEY)?.trim();
  if (!expected) return true;
  if (!providedKey || providedKey.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ providedKey.charCodeAt(i);
  }
  return mismatch === 0;
}
