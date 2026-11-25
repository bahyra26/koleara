import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Notice";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg">
      <EmptyState
        title="Halaman Tidak Ditemukan (404)"
        description="Rute yang Anda buka tidak tersedia di prototipe KOLEARA."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonClasses()}>
              Ke Beranda
            </Link>
            <Link href="/cari" className={buttonClasses({ variant: "outline" })}>
              Cari Tutor
            </Link>
          </div>
        }
      />
    </div>
  );
}
