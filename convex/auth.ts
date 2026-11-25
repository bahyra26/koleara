import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { serviceResultValidator, userObjectValidator } from "./validators";

const ITS_STUDENT_EMAIL_REGEX = /^\d{10}@student\.its\.ac\.id$/;
const DEMO_OTP_CODE = "123456";

function normalizeItsEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const listUsers = query({
  args: {},
  returns: v.array(userObjectValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query("users").take(100);
    return rows.map((row) => ({
      id: row.appId,
      email: row.email,
      name: row.name,
      role: row.role,
    }));
  },
});

export const getUserById = query({
  args: { userId: v.string() },
  returns: v.union(userObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", args.userId))
      .unique();
    if (!row) return null;
    return {
      id: row.appId,
      email: row.email,
      name: row.name,
      role: row.role,
    };
  },
});

export const requestDemoOtp = mutation({
  args: {
    email: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
  },
  returns: serviceResultValidator(
    v.object({
      email: v.string(),
      demoOtp: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const normalized = normalizeItsEmail(args.email);
    if (!normalized) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error: "Email ITS wajib diisi.",
      };
    }
    if (!ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Gunakan 10 digit NRP diikuti @student.its.ac.id (contoh: 0000000001@student.its.ac.id).",
      };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (args.mode === "login") {
      if (!existing) {
        return {
          ok: false as const,
          code: "USER_NOT_FOUND",
          error:
            "Akun demo dengan email ITS ini belum terdaftar. Gunakan akun contoh atau lanjut ke Daftar Demo.",
        };
      }
      return {
        ok: true as const,
        data: { email: normalized, demoOtp: DEMO_OTP_CODE },
      };
    }

    const trimmedName = (args.name ?? "").trim();
    if (trimmedName.length < 2) {
      return {
        ok: false as const,
        code: "INVALID_NAME",
        error: "Nama lengkap minimal 2 karakter.",
      };
    }

    if (existing) {
      return {
        ok: false as const,
        code: "EMAIL_EXISTS",
        error:
          "Email ITS demo ini sudah terdaftar. Silakan masuk melalui halaman Login.",
      };
    }

    return {
      ok: true as const,
      data: { email: normalized, demoOtp: DEMO_OTP_CODE },
    };
  },
});

export const verifyDemoOtp = mutation({
  args: {
    email: v.string(),
    otp: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
  },
  returns: serviceResultValidator(userObjectValidator),
  handler: async (ctx, args) => {
    const normalized = normalizeItsEmail(args.email);
    if (!normalized || !ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Gunakan 10 digit NRP diikuti @student.its.ac.id (contoh: 0000000001@student.its.ac.id).",
      };
    }

    const otpTrimmed = args.otp.trim();
    if (!otpTrimmed || otpTrimmed !== DEMO_OTP_CODE) {
      return {
        ok: false as const,
        code: "INVALID_OTP",
        error: `Kode OTP demo tidak sesuai. Gunakan kode demo ${DEMO_OTP_CODE}.`,
      };
    }

    const trimmedName = (args.name ?? "").trim();
    if (args.mode === "signup" && trimmedName.length < 2) {
      return {
        ok: false as const,
        code: "INVALID_NAME",
        error: "Nama lengkap minimal 2 karakter.",
      };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (args.mode === "login") {
      if (!existing) {
        return {
          ok: false as const,
          code: "USER_NOT_FOUND",
          error:
            "Akun demo tidak ditemukan. Silakan daftar demo terlebih dahulu.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          email: existing.email,
          name: existing.name,
          role: existing.role,
        },
      };
    }

    if (existing) {
      return {
        ok: false as const,
        code: "EMAIL_EXISTS",
        error: "Email ITS demo ini sudah terdaftar. Silakan gunakan Login.",
      };
    }

    const nrp = normalized.split("@")[0];
    const appId = `user-learner-${nrp}`;
    await ctx.db.insert("users", {
      appId,
      email: normalized,
      name: trimmedName,
      role: "learner",
    });

    return {
      ok: true as const,
      data: {
        id: appId,
        email: normalized,
        name: trimmedName,
        role: "learner" as const,
      },
    };
  },
});
