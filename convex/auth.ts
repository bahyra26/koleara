import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  env,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  generateNumericOtp,
  generateOpaqueSessionToken,
  isAdminRequestAuthorized,
  isDemoFallbackAllowed,
  mapUserDoc,
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  resolveActorUser,
  resolveSessionUser,
  SESSION_TTL_MS,
} from "./lib/auth";
import { buildOtpEmailHtml } from "./notifications";
import { languageValidator } from "./schema";
import {
  DEMO_OTP_CODE,
  extractCohortYearFromNrp,
  extractNrpFromItsEmail,
  ITS_STUDENT_EMAIL_REGEX,
  MAX_NAME_LENGTH,
  normalizeItsEmail,
  serviceResultValidator,
  tutorPayoutAccountObjectValidator,
  userObjectValidator,
  validateWhatsappNumber,
} from "./validators";
import { constantTimeStringEqual, sha256Hex } from "../lib/validators";

const sessionAuthDataValidator = v.object({
  user: userObjectValidator,
  sessionToken: v.string(),
  expiresAt: v.number(),
});

export const listUsers = query({
  args: {
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.array(userObjectValidator),
  handler: async (ctx, args) => {
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (!admin.authorized) return [];
    const rows = await ctx.db.query("users").take(100);
    return await Promise.all(
      rows.map((row) => mapUserDoc(ctx, row, { includePrivate: true })),
    );
  },
});

export const getUserById = query({
  args: {
    userId: v.string(),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.union(userObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_appId", (q) => q.eq("appId", args.userId))
      .first();
    if (!row) return null;

    const actor = await resolveSessionUser(ctx, args.sessionToken);
    const admin = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    const includePrivate =
      Boolean(actor && actor.appId === row.appId) || admin.authorized;

    return await mapUserDoc(ctx, row, { includePrivate });
  },
});

export const getMe = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.union(userObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await resolveSessionUser(ctx, args.sessionToken);
    if (!user) return null;
    return await mapUserDoc(ctx, user, { includePrivate: true });
  },
});

export const createOtpChallengeInternal = internalMutation({
  args: {
    email: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
    code: v.string(),
  },
  returns: serviceResultValidator(
    v.object({
      email: v.string(),
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const normalized = normalizeItsEmail(args.email);
    if (!normalized || !ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Gunakan email mahasiswa ITS 10 digit NRP (contoh: 5025261001@student.its.ac.id).",
      };
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    if (args.mode === "login" && !existingUser) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Akun ITS belum terdaftar. Silakan daftar terlebih dahulu.",
      };
    }

    if (args.mode === "signup") {
      const trimmedName = (args.name ?? "").trim();
      if (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH) {
        return {
          ok: false as const,
          code: "INVALID_NAME",
          error: `Nama lengkap wajib 2–${MAX_NAME_LENGTH} karakter.`,
        };
      }
      if (existingUser) {
        return {
          ok: false as const,
          code: "EMAIL_EXISTS",
          error: "Email mahasiswa ITS ini sudah terdaftar. Silakan login.",
        };
      }
    }

    const now = Date.now();
    const recent = await ctx.db
      .query("otpChallenges")
      .withIndex("by_email_and_createdAt", (q) => q.eq("email", normalized))
      .order("desc")
      .first();

    if (recent && now - recent.createdAt < OTP_COOLDOWN_MS && !recent.consumedAt) {
      const waitSec = Math.ceil((OTP_COOLDOWN_MS - (now - recent.createdAt)) / 1000);
      return {
        ok: false as const,
        code: "RATE_LIMITED",
        error: `Tunggu ${waitSec} detik sebelum meminta kode OTP baru.`,
      };
    }

    const codeHash = await sha256Hex(`${normalized}:${args.code}`);
    const expiresAt = now + OTP_TTL_MS;

    await ctx.db.insert("otpChallenges", {
      email: normalized,
      codeHash,
      mode: args.mode,
      name: args.name?.trim() || undefined,
      expiresAt,
      attempts: 0,
      createdAt: now,
    });

    return {
      ok: true as const,
      data: { email: normalized, expiresAt },
    };
  },
});

export const requestEmailOtp = action({
  args: {
    email: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
  },
  returns: serviceResultValidator(
    v.object({
      email: v.string(),
      expiresAt: v.number(),
      delivery: v.union(v.literal("resend"), v.literal("demo")),
      demoOtp: v.optional(v.string()),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        ok: true;
        data: {
          email: string;
          expiresAt: number;
          delivery: "resend" | "demo";
          demoOtp?: string;
        };
      }
    | { ok: false; error: string; code?: string }
  > => {
    const hasResend = Boolean(env.RESEND_API_KEY?.trim());
    const allowDemo = isDemoFallbackAllowed();
    const code = hasResend ? generateNumericOtp(6) : DEMO_OTP_CODE;

    const created:
      | { ok: true; data: { email: string; expiresAt: number } }
      | { ok: false; error: string; code?: string } = await ctx.runMutation(
      internal.auth.createOtpChallengeInternal,
      {
        email: args.email,
        mode: args.mode,
        name: args.name,
        code,
      },
    );

    if (!created.ok) {
      return created;
    }

    if (hasResend) {
      const emailPayload = buildOtpEmailHtml({
        code,
        mode: args.mode,
        name: args.name?.trim(),
      });
      const sent: { sent: boolean; skipped?: boolean; error?: string } =
        await ctx.runAction(internal.notifications.sendTransactionalEmail, {
          to: created.data.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
        });
      if (!sent.sent) {
        return {
          ok: false as const,
          code: "EMAIL_DELIVERY_FAILED",
          error:
            sent.error ??
            "Gagal mengirim email OTP ke alamat ITS. Coba lagi beberapa saat.",
        };
      }
      return {
        ok: true as const,
        data: {
          email: created.data.email,
          expiresAt: created.data.expiresAt,
          delivery: "resend" as const,
        },
      };
    }

    if (!allowDemo) {
      return {
        ok: false as const,
        code: "EMAIL_NOT_CONFIGURED",
        error: "Layanan email OTP belum dikonfigurasi pada server.",
      };
    }

    return {
      ok: true as const,
      data: {
        email: created.data.email,
        expiresAt: created.data.expiresAt,
        delivery: "demo" as const,
        demoOtp: code,
      },
    };
  },
});

export const verifyEmailOtp = mutation({
  args: {
    email: v.string(),
    otp: v.string(),
    mode: v.union(v.literal("login"), v.literal("signup")),
    name: v.optional(v.string()),
  },
  returns: serviceResultValidator(sessionAuthDataValidator),
  handler: async (ctx, args) => {
    const normalized = normalizeItsEmail(args.email);
    if (!normalized || !ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Gunakan email mahasiswa ITS 10 digit NRP (contoh: 5025261001@student.its.ac.id).",
      };
    }

    const otpTrimmed = args.otp.trim();
    if (!/^\d{6}$/.test(otpTrimmed)) {
      return {
        ok: false as const,
        code: "INVALID_OTP",
        error: "Kode OTP harus berupa 6 digit angka.",
      };
    }

    const now = Date.now();
    const challenge = await ctx.db
      .query("otpChallenges")
      .withIndex("by_email_and_createdAt", (q) => q.eq("email", normalized))
      .order("desc")
      .first();

    const hasResend = Boolean(env.RESEND_API_KEY?.trim());
    const allowDemoShortcut =
      !hasResend && isDemoFallbackAllowed() && otpTrimmed === DEMO_OTP_CODE;

    if (!allowDemoShortcut) {
      if (!challenge || challenge.consumedAt) {
        return {
          ok: false as const,
          code: "OTP_NOT_FOUND",
          error: "Kode OTP tidak ditemukan atau sudah digunakan. Minta kode baru.",
        };
      }
      if (challenge.expiresAt <= now) {
        return {
          ok: false as const,
          code: "OTP_EXPIRED",
          error: "Kode OTP sudah kedaluwarsa. Silakan minta kode baru.",
        };
      }
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        return {
          ok: false as const,
          code: "OTP_LOCKED",
          error: "Terlalu banyak percobaan OTP gagal. Silakan minta kode baru.",
        };
      }

      const providedHash = await sha256Hex(`${normalized}:${otpTrimmed}`);
      if (!constantTimeStringEqual(providedHash, challenge.codeHash)) {
        await ctx.db.patch("otpChallenges", challenge._id, {
          attempts: challenge.attempts + 1,
        });
        return {
          ok: false as const,
          code: "INVALID_OTP",
          error: "Kode OTP tidak cocok. Periksa kembali email ITS Anda.",
        };
      }

      await ctx.db.patch("otpChallenges", challenge._id, { consumedAt: now });
    } else if (challenge && !challenge.consumedAt) {
      await ctx.db.patch("otpChallenges", challenge._id, { consumedAt: now });
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();

    let userDoc = existing;
    const nrp = extractNrpFromItsEmail(normalized);
    const cohortYear = nrp ? extractCohortYearFromNrp(nrp) : undefined;

    if (args.mode === "login") {
      if (!userDoc) {
        return {
          ok: false as const,
          code: "USER_NOT_FOUND",
          error: "Akun belum terdaftar. Silakan daftar terlebih dahulu.",
        };
      }
      if (!userDoc.nrp && nrp) {
        await ctx.db.patch("users", userDoc._id, {
          nrp,
          ...(cohortYear && !userDoc.cohortYear ? { cohortYear } : {}),
        });
        userDoc = (await ctx.db.get("users", userDoc._id)) ?? userDoc;
      }
    } else {
      const trimmedName = (args.name ?? challenge?.name ?? "").trim();
      if (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH) {
        return {
          ok: false as const,
          code: "INVALID_NAME",
          error: `Nama lengkap wajib 2–${MAX_NAME_LENGTH} karakter.`,
        };
      }
      if (userDoc) {
        return {
          ok: false as const,
          code: "EMAIL_EXISTS",
          error: "Email mahasiswa ITS ini sudah terdaftar. Silakan login.",
        };
      }

      const appId = `user-learner-${nrp ?? now.toString(36)}`;
      const insertedId = await ctx.db.insert("users", {
        appId,
        email: normalized,
        name: trimmedName,
        role: "learner",
        nrp,
        cohortYear,
        preferredLanguage: "id",
        createdAt: now,
      });
      userDoc = await ctx.db.get("users", insertedId);
    }

    if (!userDoc) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Gagal memuat akun pengguna.",
      };
    }

    const sessionToken = generateOpaqueSessionToken();
    const tokenHash = await sha256Hex(sessionToken);
    const expiresAt = now + SESSION_TTL_MS;

    await ctx.db.insert("sessions", {
      tokenHash,
      userId: userDoc.appId,
      expiresAt,
      createdAt: now,
    });

    const mappedUser = await mapUserDoc(ctx, userDoc, { includePrivate: true });

    return {
      ok: true as const,
      data: {
        user: mappedUser,
        sessionToken,
        expiresAt,
      },
    };
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const token = args.sessionToken.trim();
    if (!token) return { ok: true };
    const tokenHash = await sha256Hex(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (session && !session.revokedAt) {
      await ctx.db.patch("sessions", session._id, { revokedAt: Date.now() });
    }
    return { ok: true };
  },
});

export const updateOnboardingProfile = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    department: v.string(),
    cohortYear: v.optional(v.number()),
    preferredLanguage: languageValidator,
    whatsapp: v.string(),
  },
  returns: serviceResultValidator(userObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const dept = args.department.trim();
    if (dept.length < 2 || dept.length > 80) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama departemen wajib 2–80 karakter.",
      };
    }

    const waCheck = validateWhatsappNumber(args.whatsapp);
    if (!waCheck.valid) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: waCheck.error ?? "Nomor WhatsApp tidak valid.",
      };
    }

    const nextName = args.name !== undefined ? args.name.trim() : actor.name;
    if (nextName.length < 2 || nextName.length > MAX_NAME_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_NAME",
        error: `Nama lengkap wajib 2–${MAX_NAME_LENGTH} karakter.`,
      };
    }

    const nrp = actor.nrp ?? extractNrpFromItsEmail(actor.email);
    const derivedCohort = nrp ? extractCohortYearFromNrp(nrp) : undefined;
    const cohortYear = args.cohortYear ?? actor.cohortYear ?? derivedCohort;
    if (
      cohortYear !== undefined &&
      (!Number.isInteger(cohortYear) || cohortYear < 2015 || cohortYear > 2035)
    ) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Angkatan harus berupa tahun bulat antara 2015–2035.",
      };
    }

    await ctx.db.patch("users", actor._id, {
      name: nextName,
      nrp,
      cohortYear,
      department: dept,
      preferredLanguage: args.preferredLanguage,
      whatsapp: waCheck.normalized,
      onboardedAt: actor.onboardedAt ?? now,
    });

    const updated = await ctx.db.get("users", actor._id);
    if (!updated) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Gagal menyimpan profil pengguna.",
      };
    }

    return {
      ok: true as const,
      data: await mapUserDoc(ctx, updated, { includePrivate: true }),
    };
  },
});

export const getMyPayoutAccount = query({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: v.union(tutorPayoutAccountObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
    });
    if (!actor) return null;

    const account = await ctx.db
      .query("tutorPayoutAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();
    if (!account) return null;

    return {
      tutorId: account.tutorId,
      userId: account.userId,
      bankOrWallet: account.bankOrWallet,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      updatedAt: account.updatedAt,
    };
  },
});

export const upsertMyPayoutAccount = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    bankOrWallet: v.string(),
    accountName: v.string(),
    accountNumber: v.string(),
  },
  returns: serviceResultValidator(tutorPayoutAccountObjectValidator),
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: now,
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }

    const bankOrWallet = args.bankOrWallet.trim();
    const accountName = args.accountName.trim();
    const accountNumber = args.accountNumber.replace(/\s+/g, "").trim();

    if (bankOrWallet.length < 2 || bankOrWallet.length > 50) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama bank atau e-wallet wajib 2–50 karakter.",
      };
    }
    if (accountName.length < 2 || accountName.length > 100) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nama pemilik rekening wajib 2–100 karakter.",
      };
    }
    if (!/^[0-9]{6,25}$/.test(accountNumber)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Nomor rekening / e-wallet harus 6–25 digit angka.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();
    const tutorId = tutor?.appId ?? `pending-${actor.appId}`;

    const existing = await ctx.db
      .query("tutorPayoutAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();

    if (existing) {
      await ctx.db.patch("tutorPayoutAccounts", existing._id, {
        tutorId,
        bankOrWallet,
        accountName,
        accountNumber,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("tutorPayoutAccounts", {
        tutorId,
        userId: actor.appId,
        bankOrWallet,
        accountName,
        accountNumber,
        updatedAt: now,
      });
    }

    return {
      ok: true as const,
      data: {
        tutorId,
        userId: actor.appId,
        bankOrWallet,
        accountName,
        accountNumber,
        updatedAt: now,
      },
    };
  },
});

// Backward-compatible demo OTP endpoints (still used by legacy demo UI & tests)
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
    if (!isDemoFallbackAllowed()) {
      return {
        ok: false as const,
        code: "DEMO_DISABLED",
        error: "Mode OTP demo dinonaktifkan. Gunakan requestEmailOtp.",
      };
    }

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
          "Use a 10-digit NRP followed by @student.its.ac.id (e.g. 5025261001@student.its.ac.id).",
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
            "No account found for this ITS email. Pick a demo profile or sign up.",
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
    if (!isDemoFallbackAllowed()) {
      return {
        ok: false as const,
        code: "DEMO_DISABLED",
        error: "Mode OTP demo dinonaktifkan. Gunakan verifyEmailOtp.",
      };
    }

    const normalized = normalizeItsEmail(args.email);
    if (!normalized || !ITS_STUDENT_EMAIL_REGEX.test(normalized)) {
      return {
        ok: false as const,
        code: "INVALID_EMAIL",
        error:
          "Use a 10-digit NRP followed by @student.its.ac.id (e.g. 5025261001@student.its.ac.id).",
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

    const nrp = extractNrpFromItsEmail(normalized);
    const cohortYear = nrp ? extractCohortYearFromNrp(nrp) : undefined;

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
        data: await mapUserDoc(ctx, existing, { includePrivate: true }),
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

    const now = Date.now();
    const appId = `user-learner-${nrp ?? now.toString(36)}`;
    const insertedId = await ctx.db.insert("users", {
      appId,
      email: normalized,
      name: trimmedName,
      role: "learner",
      nrp,
      cohortYear,
      preferredLanguage: "id",
      createdAt: now,
    });
    const inserted = await ctx.db.get("users", insertedId);

    return {
      ok: true as const,
      data: inserted
        ? await mapUserDoc(ctx, inserted, { includePrivate: true })
        : {
            id: appId,
            email: normalized,
            name: trimmedName,
            role: "learner" as const,
            nrp,
            cohortYear,
            preferredLanguage: "id" as const,
            createdAt: now,
          },
    };
  },
});
