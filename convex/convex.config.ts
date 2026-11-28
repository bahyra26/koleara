import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    RESEND_API_KEY: v.optional(v.string()),
    RESEND_FROM_EMAIL: v.optional(v.string()),
    MIDTRANS_SERVER_KEY: v.optional(v.string()),
    MIDTRANS_CLIENT_KEY: v.optional(v.string()),
    MIDTRANS_IS_PRODUCTION: v.optional(v.string()),
    KOLEARA_ADMIN_KEY: v.optional(v.string()),
    KOLEARA_ALLOW_DEMO_OTP: v.optional(v.string()),
    KOLEARA_STATIC_QRIS_URL: v.optional(v.string()),
    KOLEARA_STATIC_QRIS_MERCHANT: v.optional(v.string()),
    KOLEARA_APP_URL: v.optional(v.string()),
  },
});

export default app;
