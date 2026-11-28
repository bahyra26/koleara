import { verifyMidtransSignature } from "@/lib/validators";

const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site");

export async function POST(request: Request) {
  let rawText = "";
  try {
    rawText = await request.text();
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca body webhook." },
      { status: 400 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return Response.json(
      { ok: false, error: "Payload webhook harus berupa JSON valid." },
      { status: 400 },
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return Response.json(
      { ok: false, error: "Payload webhook harus berupa objek JSON." },
      { status: 400 },
    );
  }

  const body = parsed as Record<string, unknown>;
  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const statusCode =
    typeof body.status_code === "string" ? body.status_code.trim() : "";
  const grossAmount =
    typeof body.gross_amount === "string"
      ? body.gross_amount.trim()
      : typeof body.gross_amount === "number"
        ? String(body.gross_amount)
        : "";
  const signatureKey =
    typeof body.signature_key === "string" ? body.signature_key.trim() : "";

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return Response.json(
      { ok: false, error: "Field wajib Midtrans tidak lengkap." },
      { status: 400 },
    );
  }

  const localServerKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (localServerKey) {
    const valid = await verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      serverKey: localServerKey,
      signatureKey,
    });
    if (!valid) {
      return Response.json(
        { ok: false, error: "Signature Midtrans tidak valid." },
        { status: 401 },
      );
    }
  }

  if (!CONVEX_SITE_URL) {
    return Response.json(
      { ok: false, error: "CONVEX_SITE_URL belum dikonfigurasi." },
      { status: 503 },
    );
  }

  try {
    const upstream = await fetch(`${CONVEX_SITE_URL}/midtrans/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: rawText,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal meneruskan webhook ke Convex." },
      { status: 502 },
    );
  }
}
