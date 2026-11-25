import type { MeetingMode } from "@/lib/contracts";

export const ITS_STUDENT_EMAIL_REGEX = /^\d{10}@student\.its\.ac\.id$/;
export const DEMO_OTP_CODE = "123456";

export function normalizeItsEmail(raw: string): string {
  return raw.trim().toLowerCase();
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
      error: "Email ITS wajib diisi.",
    };
  }

  if (!ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Gunakan 10 digit NRP diikuti @student.its.ac.id (contoh: 0000000001@student.its.ac.id).",
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
      error: "Kode OTP demo wajib diisi.",
    };
  }
  if (normalized !== DEMO_OTP_CODE) {
    return {
      valid: false,
      normalized,
      error: `Kode OTP demo tidak sesuai. Gunakan kode demo ${DEMO_OTP_CODE}.`,
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
  return { valid: true, value: parsed };
}

const ALLOWLISTED_INTERNAL_PATHS: RegExp[] = [
  /^\/$/,
  /^\/cari$/,
  /^\/jadi-tutor$/,
  /^\/chat$/,
  /^\/chat\/[a-zA-Z0-9_-]+$/,
  /^\/tutor\/[a-zA-Z0-9_-]+$/,
  /^\/pembayaran\/[a-zA-Z0-9_-]+$/,
];

const ALLOWLISTED_QUERY_KEYS = new Set(["course", "q"]);

/**
 * Validates and sanitizes a post-login return path against an explicit allowlist
 * of internal application routes. Prevents open redirects or arbitrary URLs.
 */
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
  }

  if (input.courseIds.length === 0) {
    errors.courseIds = "Pilih minimal satu mata kuliah.";
  }

  if (input.topics.length === 0) {
    errors.topics = "Pilih atau tulis minimal satu topik.";
  }

  if (!input.bio.trim() || input.bio.trim().length < 15) {
    errors.bio = "Bio singkat minimal 15 karakter.";
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
  }

  return {
    valid: Object.keys(errors).length === 0,
    hourlyRate: rateCheck.value,
    errors,
  };
}
