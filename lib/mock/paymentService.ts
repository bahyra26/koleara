import type { CheckoutViewData, Payment, ServiceResult } from "@/lib/contracts";
import {
  getConvexMutationHandlers,
  getDemoStateSnapshot,
  updateDemoState,
} from "@/lib/mock/store";
import { sanitizeProofFileName } from "@/lib/validators";

// shortcut: demo trusts caller-supplied actorUserId and exposes client simulateVerification; replace with admin-only Convex mutations
export const paymentService = {
  getByBooking(bookingId: string): CheckoutViewData | null {
    const state = getDemoStateSnapshot();
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return null;

    const tutor = state.tutors.find((t) => t.id === booking.tutorId);
    const learner = state.users.find((u) => u.id === booking.learnerId);
    const course = state.courses.find((c) => c.id === booking.courseId);
    if (!tutor || !learner || !course) return null;

    const payment: Payment = state.payments.find(
      (p) => p.bookingId === booking.id
    ) ?? {
      id: `pay-${booking.id}`,
      bookingId: booking.id,
      amount: booking.price,
      status: booking.status === "paid" ? "paid" : "unpaid",
    };

    return { booking, payment, tutor, learner, course };
  },

  startPayment(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Payment> {
    let result: ServiceResult<Payment> = {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      error: "Data pemesanan tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Hanya mahasiswa pemesan yang dapat membuka pembayaran ini.",
        };
        return prev;
      }
      if (booking.status === "paid") {
        result = {
          ok: false,
          code: "ALREADY_PAID",
          error:
            "Pemesanan ini sudah lunas (demo). Pembayaran ulang tidak diperlukan.",
        };
        return prev;
      }
      if (booking.status !== "accepted") {
        result = {
          ok: false,
          code: "NOT_ACCEPTED",
          error:
            "Checkout hanya tersedia untuk tawaran sesi yang sudah diterima.",
        };
        return prev;
      }

      const existing = prev.payments.find((p) => p.bookingId === booking.id);
      if (existing) {
        if (existing.status === "paid") {
          result = {
            ok: false,
            code: "ALREADY_PAID",
            error: "Pembayaran ini sudah selesai.",
          };
          return prev;
        }
        result = { ok: true, data: existing };
        return prev;
      }

      const created: Payment = {
        id: `pay-${booking.id}`,
        bookingId: booking.id,
        amount: booking.price,
        status: "unpaid",
      };
      result = { ok: true, data: created };
      return {
        ...prev,
        payments: [...prev.payments, created],
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.startPayment({
        bookingId: params.bookingId,
        actorUserId: params.actorUserId,
      });
    }

    return result;
  },

  submitDemoProof(params: {
    bookingId: string;
    actorUserId: string;
    proofName?: string;
  }): ServiceResult<Payment> {
    let result: ServiceResult<Payment> = {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      error: "Data pemesanan tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Hanya mahasiswa pemesan yang dapat mengirim bukti demo.",
        };
        return prev;
      }
      if (booking.status !== "accepted") {
        result = {
          ok: false,
          code: "NOT_ACCEPTED",
          error: "Pemesanan ini tidak dalam status siap dibayar.",
        };
        return prev;
      }

      const existing = prev.payments.find((p) => p.bookingId === booking.id);
      if (existing?.status === "paid") {
        result = {
          ok: false,
          code: "ALREADY_PAID",
          error: "Pembayaran ini sudah terverifikasi (demo).",
        };
        return prev;
      }
      if (existing?.status === "pending_verification") {
        result = {
          ok: false,
          code: "ALREADY_SUBMITTED",
          error: "Bukti demo sudah dikirim dan sedang menunggu verifikasi.",
        };
        return prev;
      }

      const safeFileName = sanitizeProofFileName(params.proofName);
      const updatedPayment: Payment = {
        id: existing?.id ?? `pay-${booking.id}`,
        bookingId: booking.id,
        amount: booking.price,
        status: "pending_verification",
        proofName: safeFileName,
        submittedAt: Date.now(),
        rejectionReason: undefined,
      };
      result = { ok: true, data: updatedPayment };

      const exists = prev.payments.some((p) => p.bookingId === booking.id);
      return {
        ...prev,
        payments: exists
          ? prev.payments.map((p) =>
              p.bookingId === booking.id ? updatedPayment : p
            )
          : [...prev.payments, updatedPayment],
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.submitDemoProof({
        bookingId: params.bookingId,
        actorUserId: params.actorUserId,
        proofName: params.proofName,
      });
    }

    return result;
  },

  completeDemoQris(params: {
    bookingId: string;
    actorUserId: string;
  }): ServiceResult<Payment> {
    let result: ServiceResult<Payment> = {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      error: "Booking not found.",
    };
    let didTransition = false;

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      if (!booking) return prev;

      if (booking.learnerId !== params.actorUserId) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Only the learner who created this booking can complete payment.",
        };
        return prev;
      }

      const existing = prev.payments.find((p) => p.bookingId === booking.id);
      if (booking.status === "paid" && existing?.status === "paid") {
        result = { ok: true, data: existing };
        return prev;
      }

      if (booking.status !== "accepted") {
        result = {
          ok: false,
          code: "NOT_ACCEPTED",
          error: "This booking cannot be paid in its current state.",
        };
        return prev;
      }

      const now = Date.now();
      const paidPayment: Payment = {
        id: existing?.id ?? `pay-${booking.id}`,
        bookingId: booking.id,
        amount: booking.price,
        status: "paid",
        proofName: existing?.proofName ?? "qris-auto-demo.png",
        submittedAt: existing?.submittedAt ?? now,
        verifiedAt: now,
        rejectionReason: undefined,
      };

      didTransition = true;
      result = { ok: true, data: paidPayment };
      return {
        ...prev,
        payments: existing
          ? prev.payments.map((p) =>
              p.bookingId === booking.id ? paidPayment : p
            )
          : [...prev.payments, paidPayment],
        bookings: prev.bookings.map((b) =>
          b.id === booking.id ? { ...b, status: "paid" } : b
        ),
      };
    });

    if (didTransition) {
      getConvexMutationHandlers()?.completeDemoQris({
        bookingId: params.bookingId,
        actorUserId: params.actorUserId,
      });
    }

    return result;
  },

  simulateVerification(params: {
    bookingId: string;
    decision: "approve" | "reject";
  }): ServiceResult<Payment> {
    let result: ServiceResult<Payment> = {
      ok: false,
      code: "PAYMENT_NOT_FOUND",
      error: "Data pembayaran tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const booking = prev.bookings.find((b) => b.id === params.bookingId);
      const payment = prev.payments.find(
        (p) => p.bookingId === params.bookingId
      );
      if (!booking || !payment) return prev;

      if (
        payment.status !== "pending_verification" ||
        booking.status !== "accepted"
      ) {
        result = {
          ok: false,
          code: "INVALID_STATE",
          error:
            "Simulasi verifikasi hanya dapat dijalankan saat status Menunggu Verifikasi.",
        };
        return prev;
      }

      const now = Date.now();
      if (params.decision === "approve") {
        const paidPayment: Payment = {
          ...payment,
          status: "paid",
          verifiedAt: now,
          rejectionReason: undefined,
        };
        result = { ok: true, data: paidPayment };
        return {
          ...prev,
          payments: prev.payments.map((p) =>
            p.bookingId === booking.id ? paidPayment : p
          ),
          bookings: prev.bookings.map((b) =>
            b.id === booking.id ? { ...b, status: "paid" } : b
          ),
        };
      }

      const rejectedPayment: Payment = {
        ...payment,
        status: "rejected",
        verifiedAt: now,
        rejectionReason:
          "Verifikasi admin demo ditolak (simulasi). Anda dapat mencoba kirim ulang bukti demo.",
      };
      result = { ok: true, data: rejectedPayment };
      return {
        ...prev,
        payments: prev.payments.map((p) =>
          p.bookingId === booking.id ? rejectedPayment : p
        ),
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.simulateVerification({
        bookingId: params.bookingId,
        decision: params.decision,
      });
    }

    return result;
  },
};
