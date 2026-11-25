import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  conversationObjectValidator,
  messageObjectValidator,
  serviceResultValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";

export const getOrCreateConversation = mutation({
  args: {
    learnerId: v.string(),
    tutorId: v.string(),
  },
  returns: serviceResultValidator(conversationObjectValidator),
  handler: async (ctx, args) => {
    const [learner, tutor] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_appId", (q) => q.eq("appId", args.learnerId))
        .unique(),
      ctx.db
        .query("tutors")
        .withIndex("by_appId", (q) => q.eq("appId", args.tutorId))
        .unique(),
    ]);

    if (!learner) {
      return { ok: false as const, error: "Sesi demo tidak ditemukan." };
    }
    if (!tutor) {
      return { ok: false as const, error: "Tutor tidak ditemukan." };
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
      .unique();

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
    const appId = `conv-${args.learnerId}-${args.tutorId}`;
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
    const [users, tutors, conversations] = await Promise.all([
      ctx.db.query("users").take(100),
      ctx.db.query("tutors").take(100),
      ctx.db.query("conversations").take(100),
    ]);

    const userById = new Map(
      users.map((u) => [
        u.appId,
        { id: u.appId, email: u.email, name: u.name, role: u.role },
      ]),
    );
    const tutorById = new Map(
      tutors.map((t) => [
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
          slots: t.slots,
        },
      ]),
    );

    const summaries = [];

    for (const conv of conversations) {
      const learner = userById.get(conv.learnerId);
      const tutor = tutorById.get(conv.tutorId);
      if (!learner || !tutor) continue;

      const isLearner = conv.learnerId === args.userId;
      const isTutor = tutor.userId === args.userId;
      if (!isLearner && !isTutor) continue;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversationId_and_createdAt", (q) =>
          q.eq("conversationId", conv.appId),
        )
        .take(200);

      let lastMessage: {
        id: string;
        conversationId: string;
        senderId: string;
        type: "text" | "offer";
        content?: string;
        bookingId?: string;
        createdAt: number;
        readAt?: number;
      } | null = null;
      let unreadCount = 0;

      for (const msg of messages) {
        if (!lastMessage || msg.createdAt >= lastMessage.createdAt) {
          lastMessage = {
            id: msg.appId,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            type: msg.type,
            content: msg.content,
            bookingId: msg.bookingId,
            createdAt: msg.createdAt,
            readAt: msg.readAt,
          };
        }
        if (msg.senderId !== args.userId && !msg.readAt) {
          unreadCount += 1;
        }
      }

      summaries.push({
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
      });
    }

    summaries.sort(
      (a, b) => b.conversation.lastMessageAt - a.conversation.lastMessageAt,
    );
    return summaries;
  },
});

export const listMessages = query({
  args: { conversationId: v.string() },
  returns: v.array(messageObjectValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .take(200);

    return rows.map((row) => ({
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
      return { ok: false as const, error: "Pesan tidak boleh kosong." };
    }

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_appId", (q) => q.eq("appId", args.conversationId))
      .unique();

    if (!conversation) {
      return { ok: false as const, error: "Percakapan tidak ditemukan." };
    }

    const tutor = await ctx.db
      .query("tutors")
      .withIndex("by_appId", (q) => q.eq("appId", conversation.tutorId))
      .unique();

    const isParticipant =
      conversation.learnerId === args.senderId ||
      tutor?.userId === args.senderId;

    if (!isParticipant) {
      return {
        ok: false as const,
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
      .unique();

    if (!existing) {
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
    }

    return {
      ok: true as const,
      data: {
        id: appId,
        conversationId: conversation.appId,
        senderId: args.senderId,
        type: "text" as const,
        content: trimmed,
        createdAt: existing ? existing.createdAt : now,
      },
    };
  },
});

export const markRead = mutation({
  args: {
    conversationId: v.string(),
    readerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_and_createdAt", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .take(200);

    const now = Date.now();
    for (const msg of messages) {
      if (msg.senderId !== args.readerId && !msg.readAt) {
        await ctx.db.patch("messages", msg._id, { readAt: now });
      }
    }
    return null;
  },
});
