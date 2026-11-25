"use client";

import Link from "next/link";
import type { Tutor, User } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type ChatHeaderProps = {
  learner: User;
  tutor: Tutor;
  isLearner: boolean;
  isTutor: boolean;
  onSwitchToPeer: () => void;
};

export function ChatHeader({
  learner,
  tutor,
  isLearner,
  isTutor,
  onSwitchToPeer,
}: ChatHeaderProps) {
  const peerName = isLearner ? tutor.name : learner.name;
  const peerRole = isLearner ? "Tutor" : "Mahasiswa";

  return (
    <div className="space-y-3 border-b border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 md:hidden"
          >
            &larr; Daftar
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">
                {peerName}
              </h2>
              <Badge variant="muted">{peerRole}</Badge>
            </div>
            <p className="text-xs text-neutral-500">
              {tutor.department} ITS • Percakapan lokal (Mode Demo)
            </p>
          </div>
        </div>

        <Link
          href={`/tutor/${tutor.id}`}
          className="text-xs font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
        >
          Lihat Profil Tutor
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs">
        <div className="space-y-0.5">
          <p className="font-medium text-neutral-900">
            Kontrol Simulasi Peran Demo:{" "}
            <span className="font-normal text-neutral-700">
              Saat ini Anda masuk sebagai{" "}
              <strong>
                {isTutor
                  ? `Tutor (${tutor.name})`
                  : `Mahasiswa (${learner.name})`}
              </strong>
              .
            </span>
          </p>
          <p className="text-[11px] text-neutral-500">
            Ganti peran untuk membalas pesan atau mengirim tawaran sesi di
            percakapan ini (hanya simulasi lokal/antar tab browser yang sama).
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={onSwitchToPeer}>
          {isLearner
            ? `Beralih ke Tutor (${tutor.name})`
            : `Beralih ke Mahasiswa (${learner.name})`}
        </Button>
      </div>
    </div>
  );
}
