"use client";

import { useMemo } from "react";
import type { Role, User } from "@/lib/contracts";
import { authService } from "@/lib/mock";
import {
  useDemoHydrated,
  useDemoState,
} from "@/features/demo/DemoStoreProvider";

export function useAuth() {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const user: User | null = useMemo(() => {
    if (!state.currentUserId) return null;
    return state.users.find((u) => u.id === state.currentUserId) ?? null;
  }, [state.currentUserId, state.users]);

  const lastLearner: User | null = useMemo(() => {
    if (state.lastLearnerId) {
      const found = state.users.find((u) => u.id === state.lastLearnerId);
      if (found) return found;
    }
    return state.users.find((u) => u.role === "learner") ?? null;
  }, [state.lastLearnerId, state.users]);

  return {
    hydrated,
    user,
    users: state.users,
    lastLearner,
    isAuthenticated: Boolean(user),
    requestDemoOtp: authService.requestDemoOtp,
    verifyDemoOtp: authService.verifyDemoOtp,
    logout: authService.logout,
    switchDemoRole: (target: Role | { targetUserId: string }) =>
      authService.switchDemoRole(target),
    resetDemo: authService.resetDemo,
  };
}
