import { httpRouter } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation } from "./_generated/server";

/**
 * Internal mutation dipanggil oleh Midtrans Webhook (Bab 4.5 Brief - Issue K-15)
 * Idempoten per bookingId / order_id.
 */
export const applyWebhookSettlement = internalMutation({
  args: {
    bookingId: v.string(),
    transactionStatus: v.string(),
  },
  returns: v.object({
    processed: v.boolean(),
    newStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const booking = await ctx.db
      .query("bookings")
      .withIndex("by_appId", (q) => q.eq("appId", args.bookingId))
      .unique();

    if (!booking) {
      return { processed: false, newStatus: "not_found" };
    }

    const payment = await ctx.db
      .query("payments")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", booking.appId))
      .unique();

    const now = Date.now();
    const isSuccess =
      args.transactionStatus === "settlement" ||
      args.transactionStatus === "capture";

    if (isSuccess) {
      await ctx.db.patch("bookings", booking._id, { status: "paid" });
      if (payment) {
        await ctx.db.patch("payments", payment._id, {
          status: "paid",
          verifiedAt: now,
          rejectionReason: undefined,
        });
      } else {
        await ctx.db.insert("payments", {
          appId: `pay-${booking.appId}`,
          bookingId: booking.appId,
          amount: booking.price,
          status: "paid",
          proofName: "midtrans-webhook-settlement",
          submittedAt: now,
          verifiedAt: now,
        });
      }
      return { processed: true, newStatus: "paid" };
    }

    return { processed: true, newStatus: booking.status };
  },
});

const http = httpRouter();

http.route({
  path: "/api/midtrans/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (typeof body !== "object" || body === null) {
      return new Response(JSON.stringify({ error: "Invalid notification" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const record = body as Record<string, unknown>;
    const orderId =
      typeof record.order_id === "string" ? record.order_id.trim() : "";
    const transactionStatus =
      typeof record.transaction_status === "string"
        ? record.transaction_status.trim()
        : "";

    if (!orderId || !transactionStatus) {
      return new Response(
        JSON.stringify({
          error: "Missing order_id or transaction_status",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const result = await ctx.runMutation(
      internal.http.applyWebhookSettlement,
      {
        bookingId: orderId,
        transactionStatus,
      },
    );

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
