"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Booking, Course, MeetingMode, Payment } from "@/lib/contracts";
import { useAuth } from "@/features/auth/useAuth";

export function useConversations() {
  const { user, sessionToken, hydrated: authHydrated } = useAuth();
  const conversationsQuery = useQuery(
    api.chat.listConversations,
    user && sessionToken ? { userId: user.id, sessionToken } : "skip"
  );
  const getOrCreateMutation = useMutation(api.chat.getOrCreateConversation);

  const conversations = useMemo(
    () => conversationsQuery ?? [],
    [conversationsQuery]
  );

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    [conversations]
  );

  const getOrCreateConversation = useCallback(
    async (tutorId: string) => {
      if (!user || !sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await getOrCreateMutation({
        sessionToken,
        learnerId: user.id,
        tutorId,
      });
    },
    [user, sessionToken, getOrCreateMutation]
  );

  return {
    hydrated: authHydrated && (!user || conversationsQuery !== undefined),
    conversations,
    totalUnread,
    getOrCreateConversation,
  };
}

export function useConversationDetail(conversationId: string) {
  const { user, sessionToken, hydrated: authHydrated } = useAuth();
  const detailQuery = useQuery(
    api.chat.getConversationDetail,
    conversationId && user && sessionToken
      ? { conversationId, sessionToken, userId: user.id }
      : "skip"
  );

  const sendMessageMutation = useMutation(api.chat.sendMessage);
  const markReadMutation = useMutation(api.chat.markRead);
  const createOfferMutation = useMutation(api.bookings.createOffer);
  const acceptOfferMutation = useMutation(api.bookings.acceptOffer);
  const declineOfferMutation = useMutation(api.bookings.declineOffer);

  const bookingsById = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const b of detailQuery?.bookings ?? []) {
      map.set(b.id, b);
    }
    return map;
  }, [detailQuery?.bookings]);

  const paymentsByBookingId = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const p of detailQuery?.payments ?? []) {
      map.set(p.bookingId, p);
    }
    return map;
  }, [detailQuery?.payments]);

  const coursesById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of detailQuery?.courses ?? []) {
      map.set(c.id, c);
    }
    return map;
  }, [detailQuery?.courses]);

  const markRead = useCallback(() => {
    if (!conversationId || !user || !sessionToken || !detailQuery) return;
    void markReadMutation({
      sessionToken,
      conversationId,
      readerId: user.id,
    });
  }, [conversationId, user, sessionToken, detailQuery, markReadMutation]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !sessionToken || !conversationId) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await sendMessageMutation({
        sessionToken,
        conversationId,
        senderId: user.id,
        content,
      });
    },
    [user, sessionToken, conversationId, sendMessageMutation]
  );

  const createOffer = useCallback(
    async (input: {
      courseId: string;
      topic: string;
      startAt: number;
      price: number;
      meetingMode?: MeetingMode;
      brief?: string;
    }) => {
      if (!user || !sessionToken || !conversationId) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await createOfferMutation({
        sessionToken,
        conversationId,
        actorUserId: user.id,
        ...input,
      });
    },
    [user, sessionToken, conversationId, createOfferMutation]
  );

  const acceptOffer = useCallback(
    async (bookingId: string) => {
      if (!user || !sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await acceptOfferMutation({
        sessionToken,
        bookingId,
        actorUserId: user.id,
      });
    },
    [user, sessionToken, acceptOfferMutation]
  );

  const declineOffer = useCallback(
    async (bookingId: string) => {
      if (!user || !sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await declineOfferMutation({
        sessionToken,
        bookingId,
        actorUserId: user.id,
      });
    },
    [user, sessionToken, declineOfferMutation]
  );

  return {
    hydrated:
      authHydrated && (!conversationId || !user || detailQuery !== undefined),
    conversation: detailQuery?.conversation ?? null,
    learner: detailQuery?.learner ?? null,
    tutor: detailQuery?.tutor ?? null,
    messages: detailQuery?.messages ?? [],
    bookingsById,
    paymentsByBookingId,
    coursesById,
    courses: detailQuery?.courses ?? [],
    isLearner: detailQuery?.isLearner ?? false,
    isTutor: detailQuery?.isTutor ?? false,
    isParticipant: Boolean(detailQuery),
    markRead,
    sendMessage,
    createOffer,
    acceptOffer,
    declineOffer,
  };
}
