import type { Doc } from "../_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "../_generated/server";
import { constantTimeStringEqual, sha256Hex } from "../../lib/validators";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isDemoFallbackAllowed(): boolean {
  return env.KOLEARA_ALLOW_DEMO_OTP?.trim().toLowerCase() !== "false";
}

export function generateNumericOtp(digits = 6): string {
  const bytes = new Uint8Array(digits);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < digits; i += 1) {
    out += String(bytes[i]! % 10);
  }
  return out;
}

export function generateOpaqueSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function resolveSessionUser(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
  nowMs?: number,
): Promise<Doc<"users"> | null> {
  const token = sessionToken?.trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();

  if (!session || session.revokedAt) return null;
  if (nowMs !== undefined && session.expiresAt <= nowMs) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_appId", (q) => q.eq("appId", session.userId))
    .first();
}

/**
 * Resolves the calling user:
 * - If `sessionToken` is provided, strictly validates it (no fallback on invalid token).
 * - If `sessionToken` is omitted and demo fallback is enabled, resolves `fallbackUserId`.
 */
export async function resolveActorUser(
  ctx: QueryCtx | MutationCtx,
  params: {
    sessionToken?: string;
    fallbackUserId?: string;
    nowMs?: number;
  },
): Promise<Doc<"users"> | null> {
  if (params.sessionToken !== undefined && params.sessionToken.trim() !== "") {
    return await resolveSessionUser(ctx, params.sessionToken, params.nowMs);
  }
  if (!isDemoFallbackAllowed()) {
    return null;
  }
  const uid = params.fallbackUserId?.trim();
  if (!uid) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_appId", (q) => q.eq("appId", uid))
    .first();
}

export async function isAdminRequestAuthorized(
  ctx: QueryCtx | MutationCtx,
  params: {
    sessionToken?: string;
    adminKey?: string;
    nowMs?: number;
  },
): Promise<{ authorized: boolean; adminUserId?: string }> {
  if (params.sessionToken?.trim()) {
    const user = await resolveSessionUser(ctx, params.sessionToken, params.nowMs);
    if (user && (user.isAdmin || user.role === "admin")) {
      return { authorized: true, adminUserId: user.appId };
    }
  }

  const expectedKey = env.KOLEARA_ADMIN_KEY?.trim();
  if (expectedKey) {
    const provided = params.adminKey?.trim();
    if (provided && constantTimeStringEqual(provided, expectedKey)) {
      return { authorized: true, adminUserId: "admin-key" };
    }
    return { authorized: false };
  }

  // Fail-closed when demo fallback is explicitly disabled
  if (!isDemoFallbackAllowed()) {
    return { authorized: false };
  }

  return { authorized: true, adminUserId: "admin-demo" };
}

export function canRevealSensitiveContact(bookingStatus: string): boolean {
  return (
    bookingStatus === "paid" ||
    bookingStatus === "tutor_marked_done" ||
    bookingStatus === "completed"
  );
}

export async function mapUserDoc(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"users">,
  options?: { includePrivate?: boolean },
) {
  const avatarUrl = row.avatarStorageId
    ? ((await ctx.storage.getUrl(row.avatarStorageId)) ?? undefined)
    : undefined;
  const includePrivate = options?.includePrivate ?? false;

  return {
    id: row.appId,
    email: row.email,
    name: row.name,
    role: row.role,
    nrp: row.nrp,
    cohortYear: row.cohortYear,
    department: row.department,
    preferredLanguage: row.preferredLanguage,
    whatsapp: includePrivate ? row.whatsapp : undefined,
    isAdmin: row.isAdmin,
    avatarUrl,
    onboardedAt: row.onboardedAt,
    createdAt: row.createdAt,
  };
}

export async function mapTutorDoc(
  ctx: QueryCtx | MutationCtx,
  row: Doc<"tutors">,
) {
  const avatarUrl = row.avatarStorageId
    ? ((await ctx.storage.getUrl(row.avatarStorageId)) ?? undefined)
    : undefined;
  const reviewCount = row.reviewCount ?? 0;
  const clarityRatingAvg =
    reviewCount > 0 && typeof row.clarityRatingSum === "number"
      ? Math.round((row.clarityRatingSum / reviewCount) * 100) / 100
      : undefined;
  const pacingRatingAvg =
    reviewCount > 0 && typeof row.pacingRatingSum === "number"
      ? Math.round((row.pacingRatingSum / reviewCount) * 100) / 100
      : undefined;

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
    rating: clarityRatingAvg ?? row.rating,
    reviewCount: row.reviewCount,
    clarityRatingAvg,
    pacingRatingAvg,
    completedSessions: row.completedSessions,
    completedSessionsDemo: row.completedSessionsDemo,
    cancelledByTutorCount: row.cancelledByTutorCount,
    location: row.location,
    campusSpots: row.campusSpots,
    languages: row.languages,
    avatarUrl,
    slots: row.slots,
  };
}
