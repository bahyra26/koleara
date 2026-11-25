"use client";

import { useCallback, useMemo } from "react";
import type { Booking, Course, Payment } from "@/lib/contracts";
import { bookingService, chatService } from "@/lib/mock";
import {
  useDemoHydrated,
  useDemoState,
} from "@/features/demo/DemoStoreProvider";

export function useConversations(userId: string | null) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const conversations = useMemo(() => {
    if (!userId) return [];
    void state.conversations;
    void state.messages;
    void state.tutors;
    void state.users;
    return chatService.listConversations(userId);
  }, [state.conversations, state.messages, state.tutors, state.users, userId]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    [conversations]
  );

  return {
    hydrated,
    conversations,
    totalUnread,
    getOrCreateConversation: chatService.getOrCreateConversation,
  };
}

export function useConversationDetail(
  conversationId: string,
  activeUserId: string | null
) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const conversation = useMemo(
    () => state.conversations.find((c) => c.id === conversationId) ?? null,
    [state.conversations, conversationId]
  );

  const learner = useMemo(
    () =>
      conversation
        ? state.users.find((u) => u.id === conversation.learnerId) ?? null
        : null,
    [state.users, conversation]
  );

  const tutor = useMemo(
    () =>
      conversation
        ? state.tutors.find((t) => t.id === conversation.tutorId) ?? null
        : null,
    [state.tutors, conversation]
  );

  const tutorUser = useMemo(
    () =>
      tutor ? state.users.find((u) => u.id === tutor.userId) ?? null : null,
    [state.users, tutor]
  );

  const messages = useMemo(() => {
    void state.messages;
    return chatService.listMessages(conversationId);
  }, [state.messages, conversationId]);

  const bookingsById = useMemo(() => {
    const map = new Map<string, Booking>();
    for (const booking of state.bookings) {
      if (booking.conversationId === conversationId) {
        map.set(booking.id, booking);
      }
    }
    return map;
  }, [state.bookings, conversationId]);

  const paymentsByBookingId = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const payment of state.payments) {
      map.set(payment.bookingId, payment);
    }
    return map;
  }, [state.payments]);

  const coursesById = useMemo(() => {
    const map = new Map<string, Course>();
    for (const course of state.courses) {
      map.set(course.id, course);
    }
    return map;
  }, [state.courses]);

  const isLearner = Boolean(
    activeUserId && conversation && conversation.learnerId === activeUserId
  );
  const isTutor = Boolean(
    activeUserId && tutor && tutor.userId === activeUserId
  );
  const isParticipant = isLearner || isTutor;

  const markRead = useCallback(() => {
    if (!activeUserId || !isParticipant) return;
    chatService.markRead(conversationId, activeUserId);
  }, [activeUserId, conversationId, isParticipant]);

  return {
    hydrated,
    conversation,
    learner,
    tutor,
    tutorUser,
    messages,
    bookingsById,
    paymentsByBookingId,
    coursesById,
    courses: state.courses,
    isLearner,
    isTutor,
    isParticipant,
    markRead,
    sendMessage: chatService.sendMessage,
    createOffer: bookingService.createOffer,
    acceptOffer: bookingService.acceptOffer,
    declineOffer: bookingService.declineOffer,
  };
}
