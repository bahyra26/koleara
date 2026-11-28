"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { OfferCard } from "@/components/chat/OfferCard";
import { OfferForm } from "@/components/chat/OfferForm";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import {
  useConversationDetail,
  useConversations,
} from "@/features/chat/useChat";

type ChatWorkspaceProps = {
  activeConversationId?: string;
};

export function ChatWorkspace({ activeConversationId }: ChatWorkspaceProps) {
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { conversations } = useConversations();

  const detail = useConversationDetail(activeConversationId ?? "");
  const { isParticipant, markRead, messages } = detail;

  const [offerFormConvId, setOfferFormConvId] = useState<string | null>(null);
  const showOfferForm = Boolean(
    activeConversationId && offerFormConvId === activeConversationId
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const hadUserRef = useRef(false);

  useEffect(() => {
    if (user) {
      hadUserRef.current = true;
      return;
    }
    if (hydrated && !hadUserRef.current) {
      const nextPath = activeConversationId
        ? `/chat/${activeConversationId}`
        : "/chat";
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [hydrated, user, activeConversationId, router]);

  useEffect(() => {
    if (!hydrated || !activeConversationId || !isParticipant) return;
    markRead();
  }, [hydrated, activeConversationId, isParticipant, messages.length, markRead]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeConversationId) return;

    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = currentCount;

    if (currentCount === 0) return;

    const latestMessage = messages[currentCount - 1];
    const sentByMe = Boolean(user && latestMessage.senderId === user.id);

    if (prevCount === 0 || sentByMe || isNearBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [activeConversationId, messages, user]);

  useEffect(() => {
    prevMessageCountRef.current = 0;
    isNearBottomRef.current = true;
  }, [activeConversationId]);

  if (!hydrated) {
    return (
      <Card>
        <p className="text-sm text-[#5B686D]">Memuat ruang chat...</p>
      </Card>
    );
  }

  if (!user) {
    const nextPath = activeConversationId
      ? `/chat/${activeConversationId}`
      : "/chat";
    return (
      <Card className="mx-auto max-w-md space-y-3">
        <h1 className="text-lg font-semibold text-[#263238]">
          Login ITS Diperlukan
        </h1>
        <p className="text-sm text-[#5B686D]">
          Masuk dengan akun ITS Anda untuk membuka daftar percakapan dan
          mengirim pesan.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className={buttonClasses()}
        >
          Ke Halaman Login
        </Link>
      </Card>
    );
  }

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 80;
  };

  const renderRightPane = () => {
    if (!activeConversationId) {
      return (
        <EmptyState
          title="Pilih Percakapan"
          description="Pilih salah satu percakapan di sebelah kiri, atau cari tutor terlebih dahulu lalu klik Chat First untuk memulai obrolan."
          action={
            <Link href="/cari" className={buttonClasses()}>
              Cari Tutor
            </Link>
          }
        />
      );
    }

    if (!detail.hydrated) {
      return (
        <Card>
          <p className="text-sm text-[#5B686D]">Memuat pesan percakapan...</p>
        </Card>
      );
    }

    if (!detail.conversation || !detail.learner || !detail.tutor) {
      return (
        <EmptyState
          title="Percakapan Tidak Ditemukan"
          description="Percakapan tidak ditemukan atau Anda bukan peserta percakapan ini."
          action={
            <Link href="/chat" className={buttonClasses()}>
              Kembali ke Daftar Chat
            </Link>
          }
        />
      );
    }

    const senderNameById = new Map<string, string>([
      [detail.learner.id, detail.learner.name],
      [detail.tutor.userId, detail.tutor.name],
    ]);

    return (
      <section
        aria-label="Ruang percakapan"
        className="flex flex-col rounded-2xl border border-[#CBD6DE] bg-white"
      >
        <ChatHeader
          learner={detail.learner}
          tutor={detail.tutor}
          isLearner={detail.isLearner}
        />

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="max-h-[56vh] min-h-[280px] flex-1 space-y-3 overflow-y-auto p-4"
        >
          {detail.messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#5B686D]">
              Belum ada pesan. Mulailah diskusi topik belajar dan jadwal yang
              diinginkan.
            </div>
          ) : (
            detail.messages.map((message) => {
              if (message.type === "offer" && message.bookingId) {
                const booking = detail.bookingsById.get(message.bookingId);
                if (!booking) return null;
                return (
                  <OfferCard
                    key={message.id}
                    booking={booking}
                    course={detail.coursesById.get(booking.courseId)}
                    payment={detail.paymentsByBookingId.get(booking.id)}
                    tutorName={detail.tutor!.name}
                    isLearner={detail.isLearner}
                    onAccept={(bookingId) => detail.acceptOffer(bookingId)}
                    onDecline={(bookingId) => detail.declineOffer(bookingId)}
                  />
                );
              }

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  senderName={
                    senderNameById.get(message.senderId) ?? "Pengguna"
                  }
                  isMine={message.senderId === user.id}
                />
              );
            })
          )}
        </div>

        {detail.isTutor ? (
          showOfferForm ? (
            <OfferForm
              key={detail.conversation.id}
              tutor={detail.tutor}
              courses={detail.courses}
              onSubmitOffer={(input) => detail.createOffer(input)}
              onCancel={() => setOfferFormConvId(null)}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-[#F5F9FC] px-4 py-2">
              <p className="text-xs text-[#5B686D]">
                Siap menyepakati jadwal? Kirim kartu tawaran sesi 60 menit ke
                mahasiswa.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setOfferFormConvId(detail.conversation!.id)}
              >
                + Buat Tawaran Sesi
              </Button>
            </div>
          )
        ) : null}

        <MessageInput
          placeholder={
            detail.isTutor
              ? `Balas pesan sebagai Tutor (${detail.tutor.name})...`
              : `Tulis pesan untuk ${detail.tutor.name}...`
          }
          onSend={(content) => detail.sendMessage(content)}
        />
      </section>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-12">
      <div
        className={`${
          activeConversationId ? "hidden md:block" : "block"
        } md:col-span-4`}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          currentUser={user}
        />
      </div>
      <div
        className={`${
          activeConversationId ? "block" : "hidden md:block"
        } md:col-span-8`}
      >
        {renderRightPane()}
      </div>
    </div>
  );
}
