"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Notice";
import { authService } from "@/lib/mock";

export default function GlobalErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-8">
      <EmptyState
        title="Terjadi Kesalahan pada Tampilan Demo"
        description="Data demo lokal mungkin rusak atau tidak sesuai versi. Anda dapat mereset data demo untuk memulihkan aplikasi."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                authService.resetDemo();
                reset();
              }}
            >
              Reset Data Demo &amp; Muat Ulang
            </Button>
            <Button variant="outline" onClick={() => reset()}>
              Coba Lagi
            </Button>
          </div>
        }
      />
    </div>
  );
}
