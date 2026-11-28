import type { EscrowStatus, MeetingMode } from "./contracts";

export const ITS_STUDENT_EMAIL_REGEX = /^\d{10}@student\.its\.ac\.id$/;
export const DEMO_OTP_CODE = "123456";
export const MAX_HOURLY_RATE_IDR = 10_000_000;
export const MAX_NAME_LENGTH = 100;
export const MAX_BIO_LENGTH = 1000;
export const MAX_TOPIC_LENGTH = 120;
export const MAX_SLOT_LENGTH = 80;
export const MAX_BRIEF_LENGTH = 500;
export const MAX_MESSAGE_LENGTH = 2000;
export const CANCELLATION_FULL_REFUND_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours (Bab 4.5)
export const PAYMENT_DEADLINE_AFTER_ACCEPT_MS = 3 * 60 * 60 * 1000; // 3 hours
export const PAYMENT_DEADLINE_BEFORE_SESSION_MS = 6 * 60 * 60 * 1000; // 6 hours
export const AUTO_COMPLETE_AFTER_TUTOR_DONE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function sanitizeProofFileName(raw: string | undefined): string {
  const base = (raw ?? "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w.\- ()]/g, "_")
    .trim();
  return (base || "bukti-qris.jpg").slice(0, 120);
}

export function normalizeItsEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Extracts 10-digit NRP from a validated ITS student email.
 */
export function extractNrpFromItsEmail(email: string): string | undefined {
  const normalized = normalizeItsEmail(email);
  if (!ITS_STUDENT_EMAIL_REGEX.test(normalized)) return undefined;
  return normalized.slice(0, 10);
}

/**
 * Extracts cohort year from digits 5 & 6 (0-based indices 4..5) of a 10-digit ITS NRP.
 * Example: 5025261001 -> digits "26" -> 2026.
 * Synthetic demo NRPs like 0000000001 ("00") return undefined rather than 2000.
 */
export function extractCohortYearFromNrp(nrp: string): number | undefined {
  if (!/^\d{10}$/.test(nrp)) return undefined;
  const twoDigits = Number.parseInt(nrp.slice(4, 6), 10);
  if (!Number.isInteger(twoDigits) || twoDigits < 15 || twoDigits > 35) {
    return undefined;
  }
  return 2000 + twoDigits;
}

export function validateWhatsappNumber(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const digits = raw.replace(/[^\d+]/g, "").trim();
  if (!digits) {
    return { valid: false, normalized: "", error: "Nomor WhatsApp wajib diisi." };
  }
  let normalized = digits;
  if (normalized.startsWith("+")) normalized = normalized.slice(1);
  if (normalized.startsWith("0")) normalized = `62${normalized.slice(1)}`;
  if (!/^62\d{8,13}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: "Gunakan nomor WhatsApp Indonesia yang valid (mis. 0812xxxxxxxx atau 62812xxxxxxxx).",
    };
  }
  return { valid: true, normalized };
}

export function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha512Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies Midtrans webhook signature:
 * SHA-512(order_id + status_code + gross_amount + server_key)
 */
export async function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}): Promise<boolean> {
  const expected = await sha512Hex(
    `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`
  );
  return constantTimeStringEqual(
    expected.toLowerCase(),
    params.signatureKey.trim().toLowerCase()
  );
}

/**
 * Evaluates Bab 4.5 cancellation & refund policy:
 * - Tutor cancels (or admin cancels due to tutor no-show): always full refund to learner.
 * - Learner cancels >= 12 hours before session start: full refund.
 * - Learner cancels < 12 hours before session start: no refund (escrow becomes ready_for_payout for tutor).
 */
export function evaluateCancellationRefund(params: {
  cancelledByRole: "learner" | "tutor" | "admin";
  wasPaid: boolean;
  startAt: number;
  nowMs: number;
}): {
  refundEligible: boolean;
  nextEscrowStatus: EscrowStatus;
  reason: string;
} {
  if (!params.wasPaid) {
    return {
      refundEligible: false,
      nextEscrowStatus: "none",
      reason: "Sesi dibatalkan sebelum pembayaran dilakukan.",
    };
  }

  if (params.cancelledByRole === "tutor" || params.cancelledByRole === "admin") {
    return {
      refundEligible: true,
      nextEscrowStatus: "refunded",
      reason: "Pembatalan oleh tutor — refund penuh untuk learner.",
    };
  }

  const timeUntilSession = params.startAt - params.nowMs;
  if (timeUntilSession >= CANCELLATION_FULL_REFUND_WINDOW_MS) {
    return {
      refundEligible: true,
      nextEscrowStatus: "refunded",
      reason: "Pembatalan ≥ 12 jam sebelum sesi — refund penuh.",
    };
  }

  return {
    refundEligible: false,
    nextEscrowStatus: "ready_for_payout",
    reason: "Pembatalan < 12 jam sebelum sesi — tidak ada refund (honor diteruskan ke tutor).",
  };
}

/**
 * Computes payment deadline per Bab 4.5:
 * 3 hours after acceptance, and no later than 6 hours before session start.
 * If session is already within 6 hours, gives at least 15 minutes or until session start.
 */
export function computePaymentDeadline(acceptedAt: number, startAt: number): number {
  const threeHoursAfterAccept = acceptedAt + PAYMENT_DEADLINE_AFTER_ACCEPT_MS;
  const sixHoursBeforeStart = startAt - PAYMENT_DEADLINE_BEFORE_SESSION_MS;
  const minDeadline = Math.min(startAt, acceptedAt + 15 * 60 * 1000);
  return Math.max(minDeadline, Math.min(threeHoursAfterAccept, sixHoursBeforeStart));
}

export function validateItsEmail(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeItsEmail(raw);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: "ITS student email is required.",
    };
  }

  if (!ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Use a 10-digit NRP followed by @student.its.ac.id (e.g. 5025261001@student.its.ac.id).",
    };
  }

  return { valid: true, normalized };
}

export function validateDemoOtp(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = raw.trim();
  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: "Demo OTP code is required.",
    };
  }
  if (normalized !== DEMO_OTP_CODE) {
    return {
      valid: false,
      normalized,
      error: `Invalid demo OTP code. Use ${DEMO_OTP_CODE}.`,
    };
  }
  return { valid: true, normalized };
}

export function validatePositiveIntegerIdr(
  raw: string | number,
  fieldLabel = "Harga"
): { valid: boolean; value?: number; error?: string } {
  const str = typeof raw === "number" ? String(raw) : raw.trim();
  if (!str) {
    return { valid: false, error: `${fieldLabel} wajib diisi.` };
  }
  if (!/^\d+$/.test(str)) {
    return {
      valid: false,
      error: `${fieldLabel} harus berupa bilangan bulat positif (Rupiah).`,
    };
  }
  const parsed = Number.parseInt(str, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return {
      valid: false,
      error: `${fieldLabel} harus lebih dari Rp0.`,
    };
  }
  if (parsed > MAX_HOURLY_RATE_IDR) {
    return {
      valid: false,
      error: `${fieldLabel} maksimal Rp10.000.000.`,
    };
  }
  return { valid: true, value: parsed };
}

const ALLOWLISTED_INTERNAL_PATHS: RegExp[] = [
  /^\/$/,
  /^\/cari$/,
  /^\/jadi-tutor$/,
  /^\/onboarding$/,
  /^\/profil$/,
  /^\/sesi$/,
  /^\/sesi\/[a-zA-Z0-9_-]+$/,
  /^\/ajukan\/[a-zA-Z0-9_-]+$/,
  /^\/dashboard-tutor$/,
  /^\/kebijakan$/,
  /^\/api-docs$/,
  /^\/chat$/,
  /^\/chat\/[a-zA-Z0-9_-]+$/,
  /^\/tutor\/[a-zA-Z0-9_-]+$/,
  /^\/pembayaran\/[a-zA-Z0-9_-]+$/,
];

const ALLOWLISTED_QUERY_KEYS = new Set(["course", "q"]);

export function sanitizeReturnPath(
  raw: string | null | undefined,
  fallback = "/cari"
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://koleara.local");
    if (parsed.origin !== "http://koleara.local") {
      return fallback;
    }

    const matchesPath = ALLOWLISTED_INTERNAL_PATHS.some((pattern) =>
      pattern.test(parsed.pathname)
    );
    if (!matchesPath) {
      return fallback;
    }

    const safeParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (ALLOWLISTED_QUERY_KEYS.has(key) && value.length <= 100) {
        safeParams.set(key, value);
      }
    });

    const queryString = safeParams.toString();
    return queryString ? `${parsed.pathname}?${queryString}` : parsed.pathname;
  } catch {
    return fallback;
  }
}

export function validateOfferInput(input: {
  courseId: string;
  topic: string;
  startAt: number | null;
  priceRaw: string | number;
  meetingMode?: MeetingMode;
  brief?: string;
  nowMs?: number;
}): {
  valid: boolean;
  price?: number;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const now = input.nowMs ?? Date.now();

  if (!input.courseId.trim()) {
    errors.courseId = "Pilih mata kuliah terlebih dahulu.";
  }

  if (!input.topic.trim()) {
    errors.topic = "Topik bahasan wajib diisi.";
  } else if (input.topic.trim().length > MAX_TOPIC_LENGTH) {
    errors.topic = `Topik bahasan maksimal ${MAX_TOPIC_LENGTH} karakter.`;
  }

  if (input.brief && input.brief.trim().length > MAX_BRIEF_LENGTH) {
    errors.brief = `Catatan sesi maksimal ${MAX_BRIEF_LENGTH} karakter.`;
  }

  if (input.startAt === null || !Number.isFinite(input.startAt)) {
    errors.startAt = "Jadwal sesi (WIB) wajib diisi.";
  } else if (input.startAt <= now) {
    errors.startAt = "Jadwal sesi harus di waktu mendatang (WIB).";
  }

  const priceCheck = validatePositiveIntegerIdr(input.priceRaw, "Tarif sesi");
  if (!priceCheck.valid && priceCheck.error) {
    errors.price = priceCheck.error;
  }

  return {
    valid: Object.keys(errors).length === 0,
    price: priceCheck.value,
    errors,
  };
}

export function validateTutorApplicationInput(input: {
  name: string;
  courseIds: string[];
  topics: string[];
  bio: string;
  hourlyRateRaw: string | number;
  slots: string[];
}): {
  valid: boolean;
  hourlyRate?: number;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = "Nama lengkap minimal 2 karakter.";
  } else if (input.name.trim().length > MAX_NAME_LENGTH) {
    errors.name = `Nama lengkap maksimal ${MAX_NAME_LENGTH} karakter.`;
  }

  if (input.courseIds.length === 0) {
    errors.courseIds = "Pilih minimal satu mata kuliah.";
  }

  if (input.topics.length === 0) {
    errors.topics = "Pilih atau tulis minimal satu topik.";
  } else if (input.topics.some((t) => t.trim().length > MAX_TOPIC_LENGTH)) {
    errors.topics = `Setiap topik maksimal ${MAX_TOPIC_LENGTH} karakter.`;
  }

  if (!input.bio.trim() || input.bio.trim().length < 15) {
    errors.bio = "Bio singkat minimal 15 karakter.";
  } else if (input.bio.trim().length > MAX_BIO_LENGTH) {
    errors.bio = `Bio singkat maksimal ${MAX_BIO_LENGTH} karakter.`;
  }

  const rateCheck = validatePositiveIntegerIdr(
    input.hourlyRateRaw,
    "Tarif per 60 menit"
  );
  if (!rateCheck.valid && rateCheck.error) {
    errors.hourlyRate = rateCheck.error;
  }

  if (input.slots.length === 0) {
    errors.slots = "Tambahkan minimal satu jadwal tersedia.";
  } else if (input.slots.some((s) => s.trim().length > MAX_SLOT_LENGTH)) {
    errors.slots = `Setiap jadwal maksimal ${MAX_SLOT_LENGTH} karakter.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    hourlyRate: rateCheck.value,
    errors,
  };
}
