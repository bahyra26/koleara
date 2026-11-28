import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env } from "./_generated/server";
import { serviceResultValidator } from "./validators";

export const createSnapTransaction = action({
  args: {
    bookingId: v.string(),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: serviceResultValidator(
    v.object({
      orderId: v.string(),
      snapToken: v.string(),
      redirectUrl: v.string(),
      clientKey: v.optional(v.string()),
      isProduction: v.boolean(),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        ok: true;
        data: {
          orderId: string;
          snapToken: string;
          redirectUrl: string;
          clientKey?: string;
          isProduction: boolean;
        };
      }
    | { ok: false; error: string; code?: string }
  > => {
    const serverKey = env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) {
      return {
        ok: false as const,
        code: "MIDTRANS_NOT_CONFIGURED",
        error:
          "Midtrans belum diaktifkan. Gunakan pembayaran QRIS statis KOLEARA dan unggah bukti transfer.",
      };
    }

    const info: {
      bookingId: string;
      learnerId: string;
      learnerName: string;
      learnerEmail: string;
      tutorName: string;
      courseName: string;
      topic: string;
      amount: number;
      status: string;
      existingOrderId?: string;
      existingSnapToken?: string;
      existingRedirectUrl?: string;
    } | null = await ctx.runQuery(internal.payments.getBookingForMidtransInternal, {
      bookingId: args.bookingId,
      sessionToken: args.sessionToken,
      actorUserId: args.actorUserId,
    });

    if (!info) {
      return {
        ok: false as const,
        code: "BOOKING_NOT_FOUND",
        error: "Booking tidak ditemukan atau Anda tidak memiliki akses.",
      };
    }

    if (info.status !== "accepted") {
      return {
        ok: false as const,
        code: "NOT_ACCEPTED",
        error: "Pembayaran Snap hanya tersedia untuk sesi berstatus accepted.",
      };
    }

    const isProduction =
      env.MIDTRANS_IS_PRODUCTION?.trim().toLowerCase() === "true";

    if (info.existingOrderId && info.existingSnapToken && info.existingRedirectUrl) {
      return {
        ok: true as const,
        data: {
          orderId: info.existingOrderId,
          snapToken: info.existingSnapToken,
          redirectUrl: info.existingRedirectUrl,
          clientKey: env.MIDTRANS_CLIENT_KEY?.trim() || undefined,
          isProduction,
        },
      };
    }

    const orderId = `KLR-${info.bookingId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 28)}-${Date.now().toString(36)}`;
    const snapBaseUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const basicAuth = btoa(`${serverKey}:`);
    const res = await fetch(snapBaseUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: info.amount,
        },
        item_details: [
          {
            id: info.bookingId,
            price: info.amount,
            quantity: 1,
            name: `${info.courseName} - ${info.topic}`.slice(0, 50),
          },
        ],
        customer_details: {
          first_name: info.learnerName.slice(0, 50),
          email: info.learnerEmail,
        },
        enabled_payments: ["gopay", "qris", "bca_va", "bni_va", "bri_va"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false as const,
        code: "MIDTRANS_ERROR",
        error: `Midtrans Snap HTTP ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const body = (await res.json()) as {
      token?: unknown;
      redirect_url?: unknown;
    };
    const snapToken = typeof body.token === "string" ? body.token : "";
    const redirectUrl =
      typeof body.redirect_url === "string" ? body.redirect_url : "";
    if (!snapToken || !redirectUrl) {
      return {
        ok: false as const,
        code: "MIDTRANS_ERROR",
        error: "Respons Midtrans Snap tidak memuat token/URL pembayaran.",
      };
    }

    await ctx.runMutation(internal.payments.attachMidtransSnapInternal, {
      bookingId: info.bookingId,
      orderId,
      snapToken,
      redirectUrl,
    });

    return {
      ok: true as const,
      data: {
        orderId,
        snapToken,
        redirectUrl,
        clientKey: env.MIDTRANS_CLIENT_KEY?.trim() || undefined,
        isProduction,
      },
    };
  },
});
