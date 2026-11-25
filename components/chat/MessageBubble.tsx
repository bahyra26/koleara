import type { Message } from "@/lib/contracts";
import { formatWibTime } from "@/lib/formatters";

type MessageBubbleProps = {
  message: Message;
  senderName: string;
  isMine: boolean;
};

export function MessageBubble({
  message,
  senderName,
  isMine,
}: MessageBubbleProps) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <span className="mb-1 text-[11px] text-neutral-500">{senderName}</span>
      <div
        className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words sm:max-w-[75%] ${
          isMine
            ? "bg-neutral-900 text-white"
            : "border border-neutral-300 bg-neutral-50 text-neutral-900"
        }`}
      >
        <p>{message.content}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            isMine ? "text-neutral-300" : "text-neutral-500"
          }`}
        >
          {formatWibTime(message.createdAt)}
          {isMine ? (message.readAt ? " • Dibaca" : " • Terkirim") : ""}
        </p>
      </div>
    </div>
  );
}
