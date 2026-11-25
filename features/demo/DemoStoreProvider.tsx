"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { DemoState } from "@/lib/contracts";
import {
  getDemoHydratedServerSnapshot,
  getDemoHydratedSnapshot,
  getDemoServerSnapshot,
  getDemoStateSnapshot,
  hydrateDemoStore,
  subscribeDemoStore,
} from "@/lib/mock/store";

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    subscribeDemoStore,
    getDemoStateSnapshot,
    getDemoServerSnapshot
  );
}

export function useDemoHydrated(): boolean {
  return useSyncExternalStore(
    subscribeDemoStore,
    getDemoHydratedSnapshot,
    getDemoHydratedServerSnapshot
  );
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrateDemoStore();
  }, []);

  return <>{children}</>;
}
