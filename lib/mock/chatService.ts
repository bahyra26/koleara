import type {
  Conversation,
  ConversationSummary,
  Message,
  ServiceResult,
} from "@/lib/contracts";
import {
  createSyntheticId,
  getConvexMutationHandlers,
  getDemoStateSnapshot,
  updateDemoState,
} from "@/lib/mock/store";
import { MAX_MESSAGE_LENGTH } from "@/lib/validators";

// shortcut: demo trusts caller-supplied learnerId/senderId/readerId; derive identity from ctx.auth in Convex
export const chatService = {
  getOrCreateConversation(
    learnerId: string,
    tutorId: string
  ): ServiceResult<Conversation> {
    let result: ServiceResult<Conversation> = {
      ok: false,
      code: "USER_NOT_FOUND",
      error: "Sesi demo tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const learner = prev.users.find((u) => u.id === learnerId);
      const tutor = prev.tutors.find((t) => t.id === tutorId);

      if (!learner) return prev;
      if (!tutor || !tutor.verified) {
        result = {
          ok: false,
          code: "TUTOR_NOT_FOUND",
          error: "Tutor tidak ditemukan.",
        };
        return prev;
      }
      if (tutor.userId === learner.id) {
        result = {
          ok: false,
          code: "SELF_CHAT_NOT_ALLOWED",
          error:
            "Anda sedang menggunakan akun tutor ini. Ganti ke akun mahasiswa demo untuk menghubungi tutor ini.",
        };
        return prev;
      }

      const existing = prev.conversations.find(
        (c) => c.learnerId === learnerId && c.tutorId === tutorId
      );
      if (existing) {
        result = { ok: true, data: existing };
        return prev;
      }

      const conversation: Conversation = {
        id: `conv-${learnerId}-${tutorId}`,
        learnerId,
        tutorId,
        lastMessageAt: Date.now(),
      };
      result = { ok: true, data: conversation };
      return {
        ...prev,
        conversations: [conversation, ...prev.conversations],
      };
    });

    if (result.ok) {
      getConvexMutationHandlers()?.getOrCreateConversation({
        learnerId,
        tutorId,
      });
    }

    return result;
  },

  listConversations(userId: string): ConversationSummary[] {
    const state = getDemoStateSnapshot();
    const userById = new Map(state.users.map((u) => [u.id, u]));
    const tutorById = new Map(state.tutors.map((t) => [t.id, t]));

    const statsByConv = new Map<
      string,
      { lastMessage: Message | null; unreadCount: number }
    >();
    for (const msg of state.messages) {
      const entry = statsByConv.get(msg.conversationId) ?? {
        lastMessage: null,
        unreadCount: 0,
      };
      if (!entry.lastMessage || msg.createdAt >= entry.lastMessage.createdAt) {
        entry.lastMessage = msg;
      }
      if (msg.senderId !== userId && !msg.readAt) {
        entry.unreadCount += 1;
      }
      statsByConv.set(msg.conversationId, entry);
    }

    const summaries: ConversationSummary[] = [];

    for (const conversation of state.conversations) {
      const learner = userById.get(conversation.learnerId);
      const tutor = tutorById.get(conversation.tutorId);
      if (!learner || !tutor) continue;

      const isLearner = conversation.learnerId === userId;
      const isTutor = tutor.userId === userId;
      if (!isLearner && !isTutor) continue;

      const stats = statsByConv.get(conversation.id);
      summaries.push({
        conversation,
        learner,
        tutor,
        peerName: isLearner ? tutor.name : learner.name,
        peerRoleLabel: isLearner ? "Tutor" : "Mahasiswa",
        lastMessage: stats?.lastMessage ?? null,
        unreadCount: stats?.unreadCount ?? 0,
      });
    }

    summaries.sort(
      (a, b) => b.conversation.lastMessageAt - a.conversation.lastMessageAt
    );
    return summaries;
  },

  listMessages(conversationId: string): Message[] {
    return getDemoStateSnapshot()
      .messages.filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  sendMessage(params: {
    conversationId: string;
    senderId: string;
    content: string;
  }): ServiceResult<Message> {
    const trimmed = params.content.trim();
    if (!trimmed) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Pesan tidak boleh kosong.",
      };
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
      };
    }

    let result: ServiceResult<Message> = {
      ok: false,
      code: "CONVERSATION_NOT_FOUND",
      error: "Percakapan tidak ditemukan.",
    };
    let createdMessage: Message | null = null;

    updateDemoState((prev) => {
      const conversation = prev.conversations.find(
        (c) => c.id === params.conversationId
      );
      if (!conversation) return prev;

      const tutor = prev.tutors.find((t) => t.id === conversation.tutorId);
      const isParticipant =
        conversation.learnerId === params.senderId ||
        tutor?.userId === params.senderId;

      if (!isParticipant) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Akun demo aktif bukan peserta percakapan ini.",
        };
        return prev;
      }

      const now = Date.now();
      const message: Message = {
        id: createSyntheticId("msg"),
        conversationId: conversation.id,
        senderId: params.senderId,
        type: "text",
        content: trimmed,
        createdAt: now,
      };
      createdMessage = message;
      result = { ok: true, data: message };
      return {
        ...prev,
        messages: [...prev.messages, message],
        conversations: prev.conversations.map((c) =>
          c.id === conversation.id ? { ...c, lastMessageAt: now } : c
        ),
      };
    });

    if (createdMessage) {
      const msg: Message = createdMessage;
      getConvexMutationHandlers()?.sendMessage({
        appId: msg.id,
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        content: msg.content ?? trimmed,
      });
    }

    return result;
  },

  markRead(
    conversationId: string,
    readerId: string
  ): ServiceResult<{ read: true }> {
    const cleanReaderId = readerId.trim();
    if (!cleanReaderId) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "ID pembaca wajib diisi.",
      };
    }

    let result: ServiceResult<{ read: true }> = {
      ok: false,
      code: "CONVERSATION_NOT_FOUND",
      error: "Percakapan tidak ditemukan.",
    };
    let didMark = false;

    updateDemoState((prev) => {
      const conversation = prev.conversations.find(
        (c) => c.id === conversationId
      );
      if (!conversation) return prev;

      const tutor = prev.tutors.find((t) => t.id === conversation.tutorId);
      const isParticipant =
        conversation.learnerId === cleanReaderId ||
        tutor?.userId === cleanReaderId;
      if (!isParticipant) {
        result = {
          ok: false,
          code: "FORBIDDEN",
          error: "Hanya peserta percakapan yang dapat menandai pesan dibaca.",
        };
        return prev;
      }

      result = { ok: true, data: { read: true } };
      const hasUnread = prev.messages.some(
        (m) =>
          m.conversationId === conversationId &&
          m.senderId !== cleanReaderId &&
          !m.readAt
      );
      if (!hasUnread) return prev;
      didMark = true;

      const now = Date.now();
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.conversationId === conversationId &&
          m.senderId !== cleanReaderId &&
          !m.readAt
            ? { ...m, readAt: now }
            : m
        ),
      };
    });

    if (didMark) {
      getConvexMutationHandlers()?.markRead({
        conversationId,
        readerId: cleanReaderId,
      });
    }

    return result;
  },
};
