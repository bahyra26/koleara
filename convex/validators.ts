import { v } from "convex/values";
import {
  badgeValidator,
  bookingStatusValidator,
  meetingModeValidator,
  messageTypeValidator,
  paymentStatusValidator,
  roleValidator,
  tutorApplicationStatusValidator,
  tutorLocationValidator,
} from "./schema";

export const userObjectValidator = v.object({
  id: v.string(),
  email: v.string(),
  name: v.string(),
  role: roleValidator,
});

export const courseObjectValidator = v.object({
  id: v.string(),
  name: v.string(),
  code: v.string(),
  description: v.string(),
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
  completedSessionsDemo: v.optional(v.number()),
  location: v.optional(tutorLocationValidator),
  slots: v.array(v.string()),
});

export const tutorApplicationObjectValidator = v.object({
  id: v.string(),
  userId: v.string(),
  name: v.string(),
  courseIds: v.array(v.string()),
  topics: v.array(v.string()),
  bio: v.string(),
  hourlyRate: v.number(),
  slots: v.array(v.string()),
  status: tutorApplicationStatusValidator,
  createdAt: v.number(),
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
  price: v.number(),
  meetingMode: v.optional(meetingModeValidator),
  brief: v.optional(v.string()),
  status: bookingStatusValidator,
  createdAt: v.number(),
});

export const paymentObjectValidator = v.object({
  id: v.string(),
  bookingId: v.string(),
  amount: v.number(),
  status: paymentStatusValidator,
  proofName: v.optional(v.string()),
  submittedAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  rejectionReason: v.optional(v.string()),
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
  DEMO_OTP_CODE,
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
} from "../lib/validators";

export const SAFE_APP_ID_REGEX = /^[a-zA-Z0-9_-]{3,80}$/;

export function isValidAppId(value: string): boolean {
  return SAFE_APP_ID_REGEX.test(value);
}

// shortcut: admin endpoints stay open for Swagger/Bruno demo when KOLEARA_ADMIN_KEY is unset; set KOLEARA_ADMIN_KEY in prod to lock admin mutations
export function isAdminAuthorized(providedKey?: string): boolean {
  const expected = process.env.KOLEARA_ADMIN_KEY?.trim();
  if (!expected) return true;
  if (!providedKey || providedKey.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ providedKey.charCodeAt(i);
  }
  return mismatch === 0;
}
