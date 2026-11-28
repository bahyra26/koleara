import { v } from "convex/values";
import { query } from "./_generated/server";
import { sessionReviewObjectValidator } from "./validators";

export const listTutorReviews = query({
  args: {
    tutorId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      bookingId: v.string(),
      tutorId: v.string(),
      learnerDisplayName: v.string(),
      clarityRating: v.number(),
      pacingRating: v.number(),
      reviewText: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const cap = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const rows = await ctx.db
      .query("sessionReviews")
      .withIndex("by_tutorId_and_createdAt", (q) => q.eq("tutorId", args.tutorId))
      .order("desc")
      .take(cap);

    const uniqueLearnerIds = Array.from(new Set(rows.map((r) => r.learnerId)));
    const learnerDocs = await Promise.all(
      uniqueLearnerIds.map((uid) =>
        ctx.db
          .query("users")
          .withIndex("by_appId", (q) => q.eq("appId", uid))
          .first(),
      ),
    );
    const nameById = new Map<string, string>();
    for (const doc of learnerDocs) {
      if (!doc) continue;
      const firstName = doc.name.trim().split(/\s+/)[0] ?? "Mahasiswa ITS";
      nameById.set(doc.appId, firstName);
    }

    return rows.map((row) => ({
      id: row.appId,
      bookingId: row.bookingId,
      tutorId: row.tutorId,
      learnerDisplayName: nameById.get(row.learnerId) ?? "Mahasiswa ITS",
      clarityRating: row.clarityRating,
      pacingRating: row.pacingRating,
      reviewText: row.reviewText,
      createdAt: row.createdAt,
    }));
  },
});

export const getReviewByBooking = query({
  args: { bookingId: v.string() },
  returns: v.union(sessionReviewObjectValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sessionReviews")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", args.bookingId))
      .first();
    if (!row) return null;
    return {
      id: row.appId,
      bookingId: row.bookingId,
      learnerId: row.learnerId,
      tutorId: row.tutorId,
      clarityRating: row.clarityRating,
      pacingRating: row.pacingRating,
      reviewText: row.reviewText,
      createdAt: row.createdAt,
    };
  },
});
