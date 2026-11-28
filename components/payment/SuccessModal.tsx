import Link from "next/link";
import type { CheckoutViewData } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type SuccessModalProps = {
  open: boolean;
  data: CheckoutViewData;
  onClose: () => void;
};

export function SuccessModal({ open, data, onClose }: SuccessModalProps) {
  const { booking, payment, tutor, course } = data;

  return (
    <Modal
      open={open}
      title="Pembayaran Terverifikasi"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <Link
            href={`/sesi/${booking.id}`}
            onClick={onClose}
            className={buttonClasses({ size: "sm" })}
          >
            Buka Detail Sesi
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="solid">Lunas &amp; Dana Ditahan (Escrow)</Badge>
        </div>

        <p className="text-sm text-[#5B686D]">
          Pembayaran Anda sudah terverifikasi. Link meeting / lokasi temu dan
          kontak WhatsApp tutor sekarang sudah terbuka di halaman Detail Sesi.
        </p>

        <dl className="space-y-1.5 rounded-xl border border-[#CBD6DE] bg-[#F5F9FC] p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-[#5B686D]">Tutor</dt>
            <dd className="font-medium text-[#263238]">{tutor.name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#5B686D]">Mata Kuliah</dt>
            <dd className="font-medium text-[#263238]">{course.name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#5B686D]">Topik</dt>
            <dd className="font-medium text-[#263238]">{booking.topic}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[#5B686D]">Jadwal</dt>
            <dd className="font-medium text-[#263238]">
              {formatWibDateTime(booking.startAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-[#CBD6DE] pt-1.5">
            <dt className="font-medium text-[#5B686D]">Total</dt>
            <dd className="font-bold text-[#263238]">
              {formatIdr(payment.amount)}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
