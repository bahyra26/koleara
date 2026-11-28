"use client";

import { useCallback } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CheckoutViewData } from "@/lib/contracts";
import { useAuth } from "@/features/auth/useAuth";

export function usePaymentConfig() {
  const config = useQuery(api.payments.getPaymentConfig, {});
  return {
    hydrated: config !== undefined,
    config: config ?? null,
  };
}

export function useCheckout(bookingId: string) {
  const { user, sessionToken, hydrated: authHydrated } = useAuth();
  const dataQuery = useQuery(
    api.payments.getCheckoutByBooking,
    bookingId && user && sessionToken
      ? { bookingId, sessionToken, userId: user.id }
      : "skip"
  );

  const startPaymentMutation = useMutation(api.payments.startPayment);
  const submitProofMutation = useMutation(api.payments.submitDemoProof);
  const verifyPaymentMutation = useMutation(api.payments.simulateVerification);
  const createSnapAction = useAction(api.midtrans.createSnapTransaction);

  const startPayment = useCallback(async () => {
    if (!user || !sessionToken) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }
    return await startPaymentMutation({
      sessionToken,
      bookingId,
      actorUserId: user.id,
    });
  }, [user, sessionToken, bookingId, startPaymentMutation]);

  const submitProof = useCallback(
    async (args: { proofName?: string; proofStorageId?: Id<"_storage"> }) => {
      if (!user || !sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await submitProofMutation({
        sessionToken,
        bookingId,
        actorUserId: user.id,
        proofName: args.proofName,
        proofStorageId: args.proofStorageId,
      });
    },
    [user, sessionToken, bookingId, submitProofMutation]
  );

  const adminVerifyPayment = useCallback(
    async (decision: "approve" | "reject", rejectionReason?: string) => {
      if (!sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Akses admin diperlukan.",
        };
      }
      return await verifyPaymentMutation({
        sessionToken,
        bookingId,
        decision,
        rejectionReason,
      });
    },
    [sessionToken, bookingId, verifyPaymentMutation]
  );

  const createMidtransSnap = useCallback(async () => {
    if (!user || !sessionToken) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu.",
      };
    }
    return await createSnapAction({
      sessionToken,
      bookingId,
      actorUserId: user.id,
    });
  }, [user, sessionToken, bookingId, createSnapAction]);

  return {
    hydrated: authHydrated && (!user || dataQuery !== undefined),
    data: (dataQuery ?? null) as CheckoutViewData | null,
    startPayment,
    submitProof,
    adminVerifyPayment,
    createMidtransSnap,
  };
}
