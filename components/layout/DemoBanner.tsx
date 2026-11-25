"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/useAuth";
import { useConvexConnected } from "@/features/demo/DemoStoreProvider";

export function DemoBanner() {
  const router = useRouter();
  const { user, resetDemo } = useAuth();
  const convexConnected = useConvexConnected();
  const [confirming, setConfirming] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  const handleReset = () => {
    resetDemo();
    setConfirming(false);
    setResetNotice(true);
    router.push("/");
    window.setTimeout(() => setResetNotice(false), 3000);
  };

  return (
    <div
      role="region"
      aria-label="Status Mode Demo"
      className="border-b border-neutral-300 bg-neutral-100 text-neutral-800"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="solid">
            {convexConnected
              ? "Mode Demo — Convex Backend Aktif"
              : "Mode Demo — Frontend Prototype"}
          </Badge>
          <span className="text-neutral-600">
            {convexConnected
              ? "Tersinkronisasi real-time dengan database Convex."
              : "Data lokal (localStorage), tanpa backend/pembayaran nyata."}
          </span>
          {user ? (
            <span className="text-neutral-800">
              Sesi aktif:{" "}
              <strong>
                {user.name} ({user.role === "tutor" ? "Tutor Demo" : "Mahasiswa Demo"})
              </strong>
            </span>
          ) : (
            <span className="text-neutral-600">Sesi aktif: Tamu</span>
          )}
          {resetNotice ? (
            <span role="status" className="font-medium text-neutral-900">
              — Data demo telah direset ke kondisi awal.
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/api-docs"
            className="rounded border border-neutral-400 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
          >
            API Docs (Swagger)
          </Link>
          {confirming ? (
            <>
              <span className="text-neutral-700">Reset semua data demo?</span>
              <Button size="sm" variant="primary" onClick={handleReset}>
                Ya, Reset
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                Batal
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirming(true)}
            >
              Reset Demo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
