import type { CheckoutViewData, PaymentStatus } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type OrderSummaryProps = {
  data: CheckoutViewData;
};

function paymentStatusInfo(status: PaymentStatus): {
  label: string;
  variant: "default" | "solid" | "outline" | "muted";
} {
  switch (status) {
    case "paid":
      return { label: "Lunas & Terverifikasi", variant: "solid" };
    case "pending_verification":
      return { label: "Menunggu Verifikasi Admin", variant: "outline" };
    case "rejected":
      return { label: "Bukti Ditolak — Unggah Ulang", variant: "outline" };
    case "refunded":
      return { label: "Refund Diproses", variant: "muted" };
    default:
      return { label: "Menunggu Pembayaran", variant: "default" };
  }
}

export function OrderSummary({ data }: OrderSummaryProps) {
  const { booking, payment, tutor, course } = data;
  const badge = paymentStatusInfo(payment.status);

  return (
    <Card className="space-y-4 rounded-[22px] border-[#CBD6DE]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5B686D]">
            Ringkasan Pemesanan Sesi
          </p>
          <h2 className="text-lg font-semibold text-[#263238]">
            {course.name} — {booking.topic}
          </h2>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[#5B686D]">Tutor</dt>
          <dd className="font-medium text-[#263238]">
            {tutor.name} ({tutor.department} ITS)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5B686D]">Mata Kuliah</dt>
          <dd className="font-medium text-[#263238]">
            {course.name} ({course.code})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5B686D]">Paket &amp; Durasi</dt>
          <dd className="font-medium text-[#263238]">
            {booking.sessionCount ?? 1} sesi × {booking.durationMinutes} menit
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5B686D]">Jadwal Sesi</dt>
          <dd className="font-medium text-[#263238]">
            {formatWibDateTime(booking.startAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5B686D]">ID Booking</dt>
          <dd className="font-mono text-xs text-[#5B686D]">{booking.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5B686D]">Mode Pertemuan</dt>
          <dd className="font-medium text-[#263238]">
            {booking.meetingMode === "offline_its"
              ? "Tatap Muka (Kampus ITS)"
              : "Online"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-200 pt-3">
        <span className="text-sm font-medium text-[#5B686D]">
          Total Pembayaran
        </span>
        <span className="text-2xl font-bold text-[#263238]">
          {formatIdr(payment.amount)}
        </span>
      </div>
    </Card>
  );
}
