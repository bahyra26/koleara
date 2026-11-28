import type { Role, ServiceResult, User } from "@/lib/contracts";
import {
  getConvexMutationHandlers,
  getDemoStateSnapshot,
  resetDemoStore,
  updateDemoState,
} from "@/lib/mock/store";
import {
  DEMO_OTP_CODE,
  MAX_NAME_LENGTH,
  validateDemoOtp,
  validateItsEmail,
} from "@/lib/validators";

// shortcut: demo auth validates NRP format + static OTP 123456 locally; replace with real ITS email OTP / Convex Auth in backend
export const authService = {
  getSession(): User | null {
    const state = getDemoStateSnapshot();
    if (!state.currentUserId) return null;
    return state.users.find((u) => u.id === state.currentUserId) ?? null;
  },

  requestDemoOtp(params: {
    email: string;
    mode: "login" | "signup";
    name?: string;
  }): ServiceResult<{ email: string; demoOtp: string }> {
    const emailCheck = validateItsEmail(params.email);
    if (!emailCheck.valid) {
      return {
        ok: false,
        code: "INVALID_EMAIL",
        error: emailCheck.error ?? "Invalid ITS student email.",
      };
    }

    const existing = getDemoStateSnapshot().users.find(
      (u) => u.email === emailCheck.normalized
    );

    if (params.mode === "login") {
      if (!existing) {
        return {
          ok: false,
          code: "USER_NOT_FOUND",
          error:
            "No demo account found for this ITS email. Pick a demo profile below or sign up.",
        };
      }
      return {
        ok: true,
        data: { email: emailCheck.normalized, demoOtp: DEMO_OTP_CODE },
      };
    }

    const trimmedSignupName = (params.name ?? "").trim();
    if (
      trimmedSignupName.length < 2 ||
      trimmedSignupName.length > MAX_NAME_LENGTH
    ) {
      return {
        ok: false,
        code: "INVALID_NAME",
        error: `Full name must be 2–${MAX_NAME_LENGTH} characters.`,
      };
    }

    if (existing) {
      return {
        ok: false,
        code: "EMAIL_EXISTS",
        error:
          "This ITS student email is already registered. Please sign in instead.",
      };
    }

    return {
      ok: true,
      data: { email: emailCheck.normalized, demoOtp: DEMO_OTP_CODE },
    };
  },

  verifyDemoOtp(params: {
    email: string;
    otp: string;
    mode: "login" | "signup";
    name?: string;
  }): ServiceResult<User> {
    const emailCheck = validateItsEmail(params.email);
    if (!emailCheck.valid) {
      return {
        ok: false,
        code: "INVALID_EMAIL",
        error: emailCheck.error ?? "Invalid ITS student email.",
      };
    }

    const otpCheck = validateDemoOtp(params.otp);
    if (!otpCheck.valid) {
      return {
        ok: false,
        code: "INVALID_OTP",
        error: otpCheck.error ?? "Invalid demo OTP code.",
      };
    }

    const trimmedName = (params.name ?? "").trim();
    if (
      params.mode === "signup" &&
      (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH)
    ) {
      return {
        ok: false,
        code: "INVALID_NAME",
        error: `Full name must be 2–${MAX_NAME_LENGTH} characters.`,
      };
    }

    let result: ServiceResult<User> = {
      ok: false,
      error: "Unable to process demo session.",
    };

    updateDemoState((prev) => {
      const existing = prev.users.find(
        (u) => u.email === emailCheck.normalized
      );

      if (params.mode === "login") {
        if (!existing) {
          result = {
            ok: false,
            code: "USER_NOT_FOUND",
            error: "Demo account not found. Please sign up first.",
          };
          return prev;
        }
        result = { ok: true, data: existing };
        return {
          ...prev,
          currentUserId: existing.id,
          lastLearnerId:
            existing.role === "learner" ? existing.id : prev.lastLearnerId,
        };
      }

      if (existing) {
        result = {
          ok: false,
          code: "EMAIL_EXISTS",
          error:
            "This ITS student email is already registered. Please sign in instead.",
        };
        return prev;
      }

      const nrp = emailCheck.normalized.split("@")[0];
      const newUser: User = {
        id: `user-learner-${nrp}`,
        email: emailCheck.normalized,
        name: trimmedName,
        role: "learner",
      };
      result = { ok: true, data: newUser };
      return {
        ...prev,
        users: [...prev.users, newUser],
        currentUserId: newUser.id,
        lastLearnerId: newUser.id,
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.verifyDemoOtp({
        email: emailCheck.normalized,
        otp: otpCheck.normalized,
        mode: params.mode,
        name: trimmedName || undefined,
      });
    }

    return result;
  },

  logout(): void {
    updateDemoState((prev) => ({
      ...prev,
      currentUserId: null,
    }));
  },

  switchDemoRole(target: Role | { targetUserId: string }): ServiceResult<User> {
    let result: ServiceResult<User> = {
      ok: false,
      error: "Akun demo target tidak ditemukan.",
    };

    updateDemoState((prev) => {
      let user: User | undefined;
      if (typeof target === "string") {
        if (target === "learner" && prev.lastLearnerId) {
          user = prev.users.find((u) => u.id === prev.lastLearnerId);
        }
        if (!user) {
          user = prev.users.find((u) => u.role === target);
        }
      } else {
        user = prev.users.find((u) => u.id === target.targetUserId);
      }

      if (!user) return prev;
      result = { ok: true, data: user };
      return {
        ...prev,
        currentUserId: user.id,
        lastLearnerId: user.role === "learner" ? user.id : prev.lastLearnerId,
      };
    });

    return result;
  },

  resetDemo(): void {
    resetDemoStore();
  },
};
