import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { formatIdr } from "@/lib/formatters";

type QrisPanelProps = {
  amount: number;
};

export function QrisPanel({ amount }: QrisPanelProps) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">
          Pembayaran QRIS Statis (Simulasi)
        </h2>
        <Badge variant="solid">QRIS DEMO — JANGAN TRANSFER</Badge>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-neutral-400 bg-neutral-50 p-6 text-center">
        <div
          role="img"
          aria-label="Placeholder non-payable bertuliskan QRIS DEMO JANGAN TRANSFER"
          className="relative flex h-52 w-52 flex-col items-center justify-center rounded border-2 border-neutral-800 bg-white p-4"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 grid grid-cols-3 grid-rows-3 gap-2 opacity-20"
          >
            <div className="border-2 border-neutral-900" />
            <div className="border border-dashed border-neutral-600" />
            <div className="border-2 border-neutral-900" />
            <div className="border border-dashed border-neutral-600" />
            <div className="border border-neutral-900" />
            <div className="border border-dashed border-neutral-600" />
            <div className="border-2 border-neutral-900" />
            <div className="border border-dashed border-neutral-600" />
            <div className="border border-dashed border-neutral-600" />
          </div>
          <p className="relative z-10 rounded bg-neutral-900 px-2.5 py-1 text-xs font-bold tracking-wide text-white">
            QRIS DEMO
          </p>
          <p className="relative z-10 mt-2 text-xs font-bold text-neutral-900">
            JANGAN TRANSFER
          </p>
          <p className="relative z-10 mt-1 text-[11px] text-neutral-600">
            Placeholder non-scannable (bukan kode QR pembayaran nyata)
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Nominal yang harus diinput manual pada QRIS statis nyata
          </p>
          <p className="text-xl font-bold text-neutral-900">
            {formatIdr(amount)}
          </p>
        </div>
      </div>

      <Notice title="Penjelasan Alur QRIS Statis">
        Pada sistem nyata dengan QRIS statis, nominal tidak terisi otomatis —
        pengguna harus memasukkan nominal{" "}
        <strong>{formatIdr(amount)}</strong> secara manual lalu mengunggah bukti
        transfer agar diverifikasi manual oleh admin. Di prototipe frontend ini,
        kode di atas sengaja tidak dapat dipindai dan tidak terhubung ke bank
        atau payment gateway mana pun.
      </Notice>
    </Card>
  );
}
