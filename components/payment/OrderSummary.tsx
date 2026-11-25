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
      return { label: "Lunas (Terverifikasi Demo)", variant: "solid" };
    case "pending_verification":
      return { label: "Menunggu Verifikasi Admin (Demo)", variant: "outline" };
    case "rejected":
      return { label: "Verifikasi Ditolak — Bisa Coba Ulang", variant: "outline" };
    default:
      return { label: "Belum Dibayar", variant: "default" };
  }
}

export function OrderSummary({ data }: OrderSummaryProps) {
  const { booking, payment, tutor, course } = data;
  const badge = paymentStatusInfo(payment.status);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Ringkasan Pemesanan Sesi
          </p>
          <h2 className="text-lg font-semibold text-neutral-900">
            {course.name} — {booking.topic}
          </h2>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Tutor</dt>
          <dd className="font-medium text-neutral-900">
            {tutor.name} ({tutor.department} ITS)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Mata Kuliah</dt>
          <dd className="font-medium text-neutral-900">
            {course.name} ({course.code})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Topik</dt>
          <dd className="font-medium text-neutral-900">{booking.topic}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Jadwal &amp; Durasi</dt>
          <dd className="font-medium text-neutral-900">
            {formatWibDateTime(booking.startAt)} ({booking.durationMinutes} menit)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">ID Booking</dt>
          <dd className="font-mono text-xs text-neutral-700">{booking.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Mode Pertemuan</dt>
          <dd className="font-medium text-neutral-900">
            {booking.meetingMode === "offline_its"
              ? "Tatap Muka (Kampus ITS)"
              : "Online"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-200 pt-3">
        <span className="text-sm font-medium text-neutral-700">
          Total Pembayaran (Diambil dari Booking)
        </span>
        <span className="text-2xl font-bold text-neutral-900">
          {formatIdr(payment.amount)}
        </span>
      </div>
    </Card>
  );
}
