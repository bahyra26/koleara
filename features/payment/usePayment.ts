"use client";

import { useMemo } from "react";
import { paymentService } from "@/lib/mock";
import {
  useDemoHydrated,
  useDemoState,
} from "@/features/demo/DemoStoreProvider";

export function useCheckout(bookingId: string) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const data = useMemo(() => {
    void state.bookings;
    void state.payments;
    void state.tutors;
    void state.users;
    void state.courses;
    return paymentService.getByBooking(bookingId);
  }, [
    state.bookings,
    state.payments,
    state.tutors,
    state.users,
    state.courses,
    bookingId,
  ]);

  return {
    hydrated,
    data,
    startPayment: paymentService.startPayment,
    submitDemoProof: paymentService.submitDemoProof,
    simulateVerification: paymentService.simulateVerification,
  };
}
