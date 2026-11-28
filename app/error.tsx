"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Notice";

export default function GlobalErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <EmptyState
        title="Terjadi Kesalahan Sementara"
        description="Halaman gagal dimuat karena gangguan jaringan atau sesi yang kedaluwarsa. Silakan coba muat ulang atau kembali ke beranda."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => reset()}>Muat Ulang Halaman</Button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Kembali ke Beranda
            </Link>
          </div>
        }
      />
    </div>
  );
}
