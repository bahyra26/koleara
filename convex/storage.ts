import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  isAdminRequestAuthorized,
  resolveActorUser,
} from "./lib/auth";

export const generateUploadUrl = mutation({
  args: {
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      data: v.object({ uploadUrl: v.string() }),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      code: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: Date.now(),
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Silakan login terlebih dahulu untuk mengunggah berkas.",
      };
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return {
      ok: true as const,
      data: { uploadUrl },
    };
  },
});

export const getSignedFileUrl = query({
  args: {
    storageId: v.id("_storage"),
    purpose: v.union(
      v.literal("avatar"),
      v.literal("static_qris"),
      v.literal("tutor_proof"),
      v.literal("payment_proof"),
      v.literal("payout_proof"),
    ),
    ownerUserId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    adminKey: v.optional(v.string()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (args.purpose === "avatar" || args.purpose === "static_qris") {
      return await ctx.storage.getUrl(args.storageId);
    }

    const adminCheck = await isAdminRequestAuthorized(ctx, {
      sessionToken: args.sessionToken,
      adminKey: args.adminKey,
    });
    if (adminCheck.authorized) {
      return await ctx.storage.getUrl(args.storageId);
    }

    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
    });
    if (actor && args.ownerUserId && actor.appId === args.ownerUserId) {
      return await ctx.storage.getUrl(args.storageId);
    }

    return null;
  },
});

export const updateMyAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
    sessionToken: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      data: v.object({ avatarUrl: v.union(v.string(), v.null()) }),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
      code: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const actor = await resolveActorUser(ctx, {
      sessionToken: args.sessionToken,
      fallbackUserId: args.actorUserId,
      nowMs: Date.now(),
    });
    if (!actor) {
      return {
        ok: false as const,
        code: "UNAUTHORIZED",
        error: "Sesi tidak valid. Silakan login kembali.",
      };
    }

    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (!meta) {
      return {
        ok: false as const,
        code: "FILE_NOT_FOUND",
        error: "File gambar tidak ditemukan di penyimpanan.",
      };
    }

    const oldAvatarId = actor.avatarStorageId;
    await ctx.db.patch("users", actor._id, {
      avatarStorageId: args.storageId,
    });

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_userId", (q) => q.eq("userId", actor.appId))
      .first();
    if (tutor) {
      await ctx.db.patch("tutors", tutor._id, {
        avatarStorageId: args.storageId,
      });
    }

    if (oldAvatarId && oldAvatarId !== args.storageId) {
      await ctx.storage.delete(oldAvatarId);
    }

    const avatarUrl = await ctx.storage.getUrl(args.storageId);
    return {
      ok: true as const,
      data: { avatarUrl },
    };
  },
});
