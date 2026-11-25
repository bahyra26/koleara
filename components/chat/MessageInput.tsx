"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";

type MessageInputProps = {
  placeholder: string;
  onSend: (text: string) => { ok: boolean; error?: string };
};

export function MessageInput({ placeholder, onSend }: MessageInputProps) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const res = onSend(trimmed);
    if (!res.ok) {
      setError(res.error ?? "Gagal mengirim pesan.");
      return;
    }
    setText("");
    setError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-neutral-200 bg-white p-3"
    >
      {error ? (
        <p role="alert" className="mb-2 text-xs font-medium text-neutral-900">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor={inputId} className="sr-only">
          Tulis pesan
        </label>
        <textarea
          id={inputId}
          rows={2}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400"
        />
        <Button type="submit" disabled={text.trim().length === 0}>
          Kirim
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">
        Tekan Enter untuk kirim, Shift+Enter untuk baris baru.
      </p>
    </form>
  );
}
