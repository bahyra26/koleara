"use client";

import { useId } from "react";
import Link from "next/link";
import type { ConversationSummary, User } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { formatWibShortDate, getInitials } from "@/lib/formatters";

type ChatSidebarProps = {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  currentUser: User;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
};

export function ChatSidebar({
  conversations,
  activeConversationId,
  currentUser,
  allUsers,
  onSwitchUser,
}: ChatSidebarProps) {
  const selectId = useId();
  return (
    <aside
      aria-label="Daftar percakapan"
      className="flex h-full flex-col rounded-lg border border-neutral-200 bg-white"
    >
      <div className="space-y-2 border-b border-neutral-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold text-neutral-900">
            Percakapan ({conversations.length})
          </h1>
          <Link
            href="/cari"
            className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
          >
            + Cari Tutor
          </Link>
        </div>

        <div className="rounded border border-neutral-200 bg-neutral-50 p-2">
          <label
            htmlFor={selectId}
            className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-600"
          >
            Ganti Akun Demo (Simulasi)
          </label>
          <select
            id={selectId}
            value={currentUser.id}
            onChange={(e) => onSwitchUser(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
          >
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "tutor" ? "Tutor" : "Mahasiswa"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="p-4 text-center text-xs text-neutral-600">
          <p>Belum ada percakapan untuk akun demo ini.</p>
          <Link
            href="/cari"
            className="mt-2 inline-block font-medium text-neutral-900 underline underline-offset-4"
          >
            Cari tutor untuk mulai chat
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-y-auto">
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
                  className={`flex items-start gap-3 px-3 py-3 transition-colors ${
                    isActive
                      ? "bg-neutral-100"
                      : "bg-white hover:bg-neutral-50"
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-xs font-semibold text-neutral-800"
                  >
                    {getInitials(item.peerName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {item.peerName}
                      </p>
                      {item.unreadCount > 0 ? (
                        <Badge variant="solid">{item.unreadCount}</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      {item.peerRoleLabel} •{" "}
                      {formatWibShortDate(item.conversation.lastMessageAt)}
                    </p>
                    <p className="mt-1 truncate text-xs text-neutral-600">
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
