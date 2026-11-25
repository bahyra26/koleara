import { Suspense } from "react";
import { ChatDetailClient } from "@/components/chat/ChatDetailClient";
import { Card } from "@/components/ui/Card";

export default function ChatDetailPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <p className="text-sm text-neutral-600">Memuat percakapan...</p>
        </Card>
      }
    >
      <ChatDetailClient />
    </Suspense>
  );
}
