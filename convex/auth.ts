import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  DEMO_OTP_CODE,
  isAdminAuthorized,
  ITS_STUDENT_EMAIL_REGEX,
  MAX_NAME_LENGTH,
  normalizeItsEmail,
  serviceResultValidator,
  userObjectValidator,
} from "./validators";

export const listUsers = query({
  args: { adminKey: v.optional(v.string()) },
  returns: v.array(userObjectValidator),
  handler: async (ctx, args) => {
    if (!isAdminAuthorized(args.adminKey)) return [];
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
      .first();
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
        error: "ITS student email is required.",
      };
    }
    if (!ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Use a 10-digit NRP followed by @student.its.ac.id (e.g. 0000000001@student.its.ac.id).",
      };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (args.mode === "login") {
      if (!existing) {
        return {
          ok: false as const,
          code: "USER_NOT_FOUND",
          error:
            "No demo account found for this ITS email. Pick a demo profile or sign up.",
        };
      }
      return {
        ok: true as const,
        data: { email: normalized, demoOtp: DEMO_OTP_CODE },
      };
    }

    const trimmedName = (args.name ?? "").trim();
    if (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_NAME",
        error: `Full name must be 2–${MAX_NAME_LENGTH} characters.`,
      };
    }

    if (existing) {
      return {
        ok: false as const,
        code: "EMAIL_EXISTS",
        error:
          "This ITS student email is already registered. Please sign in instead.",
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
          "Use a 10-digit NRP followed by @student.its.ac.id (e.g. 0000000001@student.its.ac.id).",
      };
    }

    const otpTrimmed = args.otp.trim();
    if (!otpTrimmed || otpTrimmed !== DEMO_OTP_CODE) {
      return {
        ok: false as const,
        code: "INVALID_OTP",
        error: `Invalid demo OTP code. Use ${DEMO_OTP_CODE}.`,
      };
    }

    const trimmedName = (args.name ?? "").trim();
    if (
      args.mode === "signup" &&
      (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH)
    ) {
      return {
        ok: false as const,
        code: "INVALID_NAME",
        error: `Full name must be 2–${MAX_NAME_LENGTH} characters.`,
      };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (args.mode === "login") {
      if (!existing) {
        return {
          ok: false as const,
          code: "USER_NOT_FOUND",
          error: "Demo account not found. Please sign up first.",
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
        error:
          "This ITS student email is already registered. Please sign in instead.",
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
