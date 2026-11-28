"use client";

import Link from "next/link";
import type { ConversationSummary, User } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { formatWibShortDate, getInitials } from "@/lib/formatters";

type ChatSidebarProps = {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  currentUser: User;
};

export function ChatSidebar({
  conversations,
  activeConversationId,
  currentUser,
}: ChatSidebarProps) {
  return (
    <aside
      aria-label="Daftar percakapan"
      className="flex h-full flex-col rounded-2xl border border-[#CBD6DE] bg-white"
    >
      <div className="space-y-1 border-b border-[#EAEAEA] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold text-[#263238]">
            Percakapan ({conversations.length})
          </h1>
          <Link
            href="/cari"
            className="text-xs font-medium text-[#3979A5] underline underline-offset-4 hover:text-[#285B7B]"
          >
            + Cari Tutor
          </Link>
        </div>
        <p className="truncate text-xs text-[#5B686D]">
          Masuk sebagai <strong>{currentUser.name}</strong>
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="p-4 text-center text-xs text-[#5B686D]">
          <p>Belum ada percakapan.</p>
          <Link
            href="/cari"
            className="mt-2 inline-block font-semibold text-[#3979A5] underline underline-offset-4"
          >
            Cari tutor untuk mulai chat
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#EAEAEA] overflow-y-auto">
          {conversations.map((item) => {
            const isActive = item.conversation.id === activeConversationId;
            const preview = item.lastMessage
              ? item.lastMessage.type === "offer"
                ? "[Tawaran Sesi 60 Menit]"
                : item.lastMessage.content ?? ""
              : "Belum ada pesan.";

            return (
              <li key={item.conversation.id}>
                <Link
                  href={`/chat/${item.conversation.id}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-start gap-3 px-3.5 py-3 transition-colors ${
                    isActive
                      ? "bg-[#EAF2F7]"
                      : "bg-white hover:bg-[#F5F9FC]"
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8EB4CE] bg-[#F5F9FC] text-xs font-semibold text-[#285B7B]"
                  >
                    {getInitials(item.peerName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#263238]">
                        {item.peerName}
                      </p>
                      {item.unreadCount > 0 ? (
                        <Badge variant="solid">{item.unreadCount}</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-[#5B686D]">
                      {item.peerRoleLabel} •{" "}
                      {formatWibShortDate(item.conversation.lastMessageAt)}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#5B686D]">
                      {preview}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
