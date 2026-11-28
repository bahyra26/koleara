import { v } from "convex/values";
import { env, internalAction } from "./_generated/server";

export const sendTransactionalEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    text: v.optional(v.string()),
  },
  returns: v.object({
    sent: v.boolean(),
    skipped: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    const apiKey = env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return { sent: false, skipped: true };
    }

    const from =
      env.RESEND_FROM_EMAIL?.trim() || "KOLEARA ITS <onboarding@resend.dev>";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          ...(args.text ? { text: args.text } : {}),
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return {
          sent: false,
          error: `Resend HTTP ${res.status}: ${errBody.slice(0, 200)}`,
        };
      }

      return { sent: true };
    } catch (error) {
      return {
        sent: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  },
});

export function buildOtpEmailHtml(params: {
  code: string;
  mode: "login" | "signup";
  name?: string;
}): { subject: string; html: string; text: string } {
  const greeting = params.name ? `Halo ${params.name},` : "Halo Mahasiswa ITS,";
  const actionLabel =
    params.mode === "signup"
      ? "mendaftar akun KOLEARA"
      : "masuk ke akun KOLEARA";
  const subject = `[KOLEARA] Kode OTP Verifikasi ITS: ${params.code}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #263238;">
      <h2 style="color: #285B7B; margin-bottom: 8px;">KOLEARA — Verifikasi Email ITS</h2>
      <p>${greeting}</p>
      <p>Gunakan kode 6 digit berikut untuk ${actionLabel}:</p>
      <div style="background: #E5EFF4; border: 1px solid #8FB5CD; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #285B7B;">${params.code}</span>
      </div>
      <p style="font-size: 13px; color: #5B686D;">
        Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
      </p>
      <p style="font-size: 12px; color: #A3ADB1; margin-top: 20px;">
        Tips Outlook ITS: jika email ini masuk folder Junk, tandai sebagai "Not Junk" agar notifikasi sesi berikutnya masuk ke Inbox.
      </p>
    </div>
  `.trim();
  const text = `${greeting}\n\nKode OTP KOLEARA untuk ${actionLabel}: ${params.code}\nBerlaku selama 10 menit.`;
  return { subject, html, text };
}
