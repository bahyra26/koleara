import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  conversationObjectValidator,
  isValidAppId,
  MAX_MESSAGE_LENGTH,
  messageObjectValidator,
  serviceResultValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";

// shortcut: demo trusts caller-supplied learnerId/senderId/readerId until Convex Auth is wired
export const getOrCreateConversation = mutation({
  args: {
    appId: v.optional(v.string()),
    learnerId: v.string(),
    tutorId: v.string(),
  },
  returns: serviceResultValidator(conversationObjectValidator),
  handler: async (ctx, args) => {
    if (args.appId !== undefined && !isValidAppId(args.appId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Format ID percakapan tidak valid.",
      };
    }

    const [learner, tutor] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", args.learnerId))
        .first(),
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
        .first(),
    ]);

    if (!learner) {
      return {
        ok: false as const,
        code: "USER_NOT_FOUND",
        error: "Sesi demo tidak ditemukan.",
      };
    }
    if (!tutor || !tutor.verified) {
      return {
        ok: false as const,
        code: "TUTOR_NOT_FOUND",
        error: "Tutor tidak ditemukan.",
      };
    }
    if (tutor.userId === learner.appId) {
      return {
        ok: false as const,
        code: "SELF_CHAT_NOT_ALLOWED",
        error:
          "Anda sedang menggunakan akun tutor ini. Ganti ke akun mahasiswa demo untuk menghubungi tutor ini.",
      };
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_learnerId_and_tutorId", (q) =>
        q.eq("learnerId", args.learnerId).eq("tutorId", args.tutorId),
      )
      .first();

    if (existing) {
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          learnerId: existing.learnerId,
          tutorId: existing.tutorId,
          lastMessageAt: existing.lastMessageAt,
        },
      };
    }

    const now = Date.now();
    const appId =
      args.appId ??
      `conv-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await ctx.db.insert("conversations", {
      appId,
      learnerId: args.learnerId,
      tutorId: args.tutorId,
      lastMessageAt: now,
    });

    return {
      ok: true as const,
      data: {
        id: appId,
        learnerId: args.learnerId,
        tutorId: args.tutorId,
        lastMessageAt: now,
      },
    };
  },
});

export const listConversations = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      conversation: conversationObjectValidator,
      learner: userObjectValidator,
      tutor: tutorObjectValidator,
      peerName: v.string(),
      peerRoleLabel: v.string(),
      lastMessage: v.union(messageObjectValidator, v.null()),
      unreadCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!args.userId.trim()) return [];

    const [asLearnerConvs, myTutors] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_learnerId_and_lastMessageAt", (q) =>
          q.eq("learnerId", args.userId),
        )
        .order("desc")
        .take(100),
      ctx.db
        .query("tutors")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(5),
    ]);

    const asTutorConvLists = await Promise.all(
      myTutors.map((t) =>
        ctx.db
          .query("conversations")
          .withIndex("by_tutorId_and_lastMessageAt", (q) =>
            q.eq("tutorId", t.appId),
          )
          .order("desc")
          .take(100),
      ),
    );

    const convByAppId = new Map<string, (typeof asLearnerConvs)[number]>();
    for (const conv of asLearnerConvs) {
      convByAppId.set(conv.appId, conv);
    }
    for (const list of asTutorConvLists) {
      for (const conv of list) {
        convByAppId.set(conv.appId, conv);
      }
    }

    const conversations = Array.from(convByAppId.values());
    if (conversations.length === 0) return [];

    const uniqueLearnerIds = Array.from(
      new Set(conversations.map((c) => c.learnerId)),
    );
    const uniqueTutorIds = Array.from(
      new Set(conversations.map((c) => c.tutorId)),
    );

    const [learnerDocs, tutorDocs] = await Promise.all([
      Promise.all(
        uniqueLearnerIds.map((uid) =>
          ctx.db
            .query("users")
            .withIndex("by_appId", (q) => q.eq("appId", uid))
            .first(),
        ),
      ),
      Promise.all(
        uniqueTutorIds.map((tid) =>
          ctx.db
            .query("tutors")
            .withIndex("by_appId", (q) => q.eq("appId", tid))
            .first(),
        ),
      ),
    ]);

    const userById = new Map(
      learnerDocs
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map((u) => [
          u.appId,
          { id: u.appId, email: u.email, name: u.name, role: u.role },
        ]),
    );
    const tutorById = new Map(
      tutorDocs
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .map((t) => [
          t.appId,
          {
            id: t.appId,
            userId: t.userId,
            name: t.name,
            department: t.department,
            cohort: t.cohort,
            bio: t.bio,
            courseIds: t.courseIds,
            topics: t.topics,
            hourlyRate: t.hourlyRate,
            verified: t.verified,
            badge: t.badge,
            rating: t.rating,
            completedSessionsDemo: t.completedSessionsDemo,
            location: t.location,
            slots: t.slots,
          },
        ]),
    );

    const eligible = conversations.flatMap((conv) => {
      const learner = userById.get(conv.learnerId);
      const tutor = tutorById.get(conv.tutorId);
      if (!learner || !tutor) return [];
      const isLearner = conv.learnerId === args.userId;
      const isTutor = tutor.userId === args.userId;
      if (!isLearner && !isTutor) return [];
      return [{ conv, learner, tutor, isLearner }];
    });

    const summaries = await Promise.all(
      eligible.map(async ({ conv, learner, tutor, isLearner }) => {
        const recentMessagesDesc = await ctx.db
          .query("messages")
          .withIndex("by_conversationId_and_createdAt", (q) =>
            q.eq("conversationId", conv.appId),
          )
          .order("desc")
          .take(50);

        const newest = recentMessagesDesc[0];
        const lastMessage = newest
          ? {
              id: newest.appId,
              conversationId: newest.conversationId,
              senderId: newest.senderId,
              type: newest.type,
              content: newest.content,
              bookingId: newest.bookingId,
              createdAt: newest.createdAt,
              readAt: newest.readAt,
            }
          : null;

        let unreadCount = 0;
        for (const msg of recentMessagesDesc) {
          if (msg.senderId !== args.userId && !msg.readAt) {
            unreadCount += 1;
          }
        }

        return {
          conversation: {
            id: conv.appId,
            learnerId: conv.learnerId,
            tutorId: conv.tutorId,
            lastMessageAt: conv.lastMessageAt,
          },
          learner,
          tutor,
          peerName: isLearner ? tutor.name : learner.name,
          peerRoleLabel: isLearner ? "Tutor" : "Mahasiswa",
          lastMessage,
          unreadCount,
        };
      }),
    );

    summaries.sort(
      (a, b) => b.conversation.lastMessageAt - a.conversation.lastMessageAt,
    );
    return summaries;
  },
});

export const listMessages = query({
  args: {
    conversationId: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.array(messageObjectValidator),
  handler: async (ctx, args) => {
    if (args.userId !== undefined) {
      const uid = args.userId.trim();
      if (!uid) return [];
      const conversation = await ctx.db
        .query("conversations")
        .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
        .first();
      if (!conversation) return [];
      if (conversation.learnerId !== uid) {
        const tutor = await ctx.db
          .query("tutors")
          .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
          .first();
        if (tutor?.userId !== uid) return [];
      }
    }

    const rowsDesc = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(200);

    return rowsDesc.reverse().map((row) => ({
      id: row.appId,
      conversationId: row.conversationId,
      senderId: row.senderId,
      type: row.type,
      content: row.content,
      bookingId: row.bookingId,
      createdAt: row.createdAt,
      readAt: row.readAt,
    }));
  },
});

export const sendMessage = mutation({
  args: {
    appId: v.optional(v.string()),
    conversationId: v.string(),
    senderId: v.string(),
    content: v.string(),
  },
  returns: serviceResultValidator(messageObjectValidator),
  handler: async (ctx, args) => {
    const trimmed = args.content.trim();
    if (!trimmed) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "Pesan tidak boleh kosong.",
      };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
      };
    }
    if (args.appId !== undefined && !isValidAppId(args.appId)) {
      return {
        ok: false as const,
        code: "INVALID_INPUT",
        error: "ID pesan tidak valid.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
      .first();

    if (!conversation) {
      return {
        ok: false as const,
        code: "CONVERSATION_NOT_FOUND",
        error: "Percakapan tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
      .first();

    const isParticipant =
      conversation.learnerId === args.senderId ||
      tutor?.userId === args.senderId;

    if (!isParticipant) {
      return {
        ok: false as const,
        code: "FORBIDDEN",
        error: "Akun demo aktif bukan peserta percakapan ini.",
      };
    }

    const now = Date.now();
    const appId =
      args.appId ??
      `msg-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_appId", (q) => q.eq("appId", appId))
      .first();

    if (existing) {
      if (
        existing.conversationId !== conversation.appId ||
        existing.senderId !== args.senderId
      ) {
        return {
          ok: false as const,
          code: "CONFLICT",
          error: "ID pesan sudah digunakan.",
        };
      }
      return {
        ok: true as const,
        data: {
          id: existing.appId,
          conversationId: existing.conversationId,
          senderId: existing.senderId,
          type: existing.type,
          content: existing.content,
          bookingId: existing.bookingId,
          createdAt: existing.createdAt,
          readAt: existing.readAt,
        },
      };
    }

    await ctx.db.insert("messages", {
      appId,
      conversationId: conversation.appId,
      senderId: args.senderId,
      type: "text",
      content: trimmed,
      createdAt: now,
    });

    await ctx.db.patch("conversations", conversation._id, {
      lastMessageAt: now,
    });

    return {
      ok: true as const,
      data: {
        id: appId,
        conversationId: conversation.appId,
        senderId: args.senderId,
        type: "text" as const,
        content: trimmed,
        createdAt: now,
      },
    };
  },
});

export const markRead = mutation({
  args: {
    conversationId: v.string(),
    readerId: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    error: v.optional(v.string()),
    code: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const readerId = args.readerId.trim();
    if (!readerId) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "ID pembaca wajib diisi.",
      };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
      .first();
    if (!conversation) {
      return {
        ok: false,
        code: "CONVERSATION_NOT_FOUND",
        error: "Percakapan tidak ditemukan.",
      };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
      .first();

    const isParticipant =
      conversation.learnerId === readerId || tutor?.userId === readerId;
    if (!isParticipant) {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "Hanya peserta percakapan yang dapat menandai pesan dibaca.",
      };
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(200);

    const now = Date.now();
    for (const msg of messages) {
      if (msg.senderId !== readerId && !msg.readAt) {
        await ctx.db.patch("messages", msg._id, { readAt: now });
      }
    }
    return { ok: true };
  },
});
