"use client";

import Link from "next/link";
import type { Tutor, User } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";

type ChatHeaderProps = {
  learner: User;
  tutor: Tutor;
  isLearner: boolean;
};

export function ChatHeader({ learner, tutor, isLearner }: ChatHeaderProps) {
  const peerName = isLearner ? tutor.name : learner.name;
  const peerRole = isLearner ? "Tutor ITS" : "Mahasiswa ITS";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 p-4">
      <div className="flex items-center gap-3">
        <Link
          href="/chat"
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 md:hidden"
        >
          &larr; Daftar
        </Link>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[#263238]">
              {peerName}
            </h2>
            <Badge variant="muted">{peerRole}</Badge>
          </div>
          <p className="text-xs text-[#5B686D]">
            {tutor.department} ITS • Percakapan real-time
          </p>
        </div>
      </div>

      <Link
        href={`/tutor/${tutor.id}`}
        className="text-xs font-medium text-[#3979A5] underline underline-offset-4 hover:text-[#285B7B]"
      >
        Lihat Profil Tutor
      </Link>
    </div>
  );
}
