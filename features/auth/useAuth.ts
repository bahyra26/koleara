"use client";

import { useSessionAuth } from "@/features/providers/KolearaProvider";

export function useAuth() {
  return useSessionAuth();
}
