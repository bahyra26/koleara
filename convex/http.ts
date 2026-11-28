import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { verifyMidtransSignature } from "../lib/validators";

const http = httpRouter();

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ ok: true, service: "koleara-convex-http" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
});

http.route({
  path: "/midtrans/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const serverKey = env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "MIDTRANS_SERVER_KEY not set" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Expected JSON object" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = raw as Record<string, unknown>;
    const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
    const statusCode =
      typeof body.status_code === "string" ? body.status_code.trim() : "";
    const grossAmountRaw =
      typeof body.gross_amount === "string"
        ? body.gross_amount.trim()
        : typeof body.gross_amount === "number"
          ? String(body.gross_amount)
          : "";
    const signatureKey =
      typeof body.signature_key === "string" ? body.signature_key.trim() : "";
    const transactionStatus =
      typeof body.transaction_status === "string"
        ? body.transaction_status.trim()
        : "";
    const fraudStatus =
      typeof body.fraud_status === "string" ? body.fraud_status.trim() : undefined;
    const transactionId =
      typeof body.transaction_id === "string"
        ? body.transaction_id.trim()
        : undefined;
    const paymentType =
      typeof body.payment_type === "string" ? body.payment_type.trim() : undefined;

    if (
      !orderId ||
      !statusCode ||
      !grossAmountRaw ||
      !signatureKey ||
      !transactionStatus
    ) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required Midtrans fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const validSig = await verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount: grossAmountRaw,
      serverKey,
      signatureKey,
    });
    if (!validSig) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const grossAmount = Number(grossAmountRaw);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid gross_amount" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await ctx.runMutation(
      internal.payments.handleMidtransWebhookInternal,
      {
        orderId,
        transactionStatus,
        fraudStatus,
        transactionId,
        paymentType,
        grossAmount,
      },
    );

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
