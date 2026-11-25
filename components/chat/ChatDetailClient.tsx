"use client";

import { useParams } from "next/navigation";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export function ChatDetailClient() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  return <ChatWorkspace activeConversationId={id} />;
}
