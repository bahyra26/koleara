"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import type { PaymentConfig } from "@/lib/contracts";
import { formatIdr } from "@/lib/formatters";

type QrisPanelProps = {
  amount: number;
  config?: PaymentConfig | null;
};

export function QrisPanel({ amount, config }: QrisPanelProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const merchantName = config?.merchantName || "KOLEARA ITS";
  const qrisUrl = config?.qrisImageUrl || "/qris-koleara.png";
  const instructions =
    config?.instructions ||
    "Scan QRIS KOLEARA menggunakan e-wallet atau mobile banking Anda, masukkan nominal tepat sesuai tagihan, lalu unggah bukti transfer di bawah.";

  return (
    <Card className="space-y-4 rounded-[22px] border-[#8EB4CE]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[#263238]">
          Pembayaran QRIS — {merchantName}
        </h2>
        <Badge variant="solid">QRIS Statis KOLEARA</Badge>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#CBD6DE] bg-[#F5F9FC] p-5 text-center">
        {!imgFailed ? (
          <div className="overflow-hidden rounded-2xl border border-[#5B8FB3] bg-white p-3 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrisUrl}
              alt={`QRIS ${merchantName}`}
              onError={() => setImgFailed(true)}
              className="h-64 w-64 object-contain sm:h-72 sm:w-72"
            />
          </div>
        ) : (
          <div className="flex h-60 w-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#8EB4CE] bg-white p-4 text-center">
            <p className="text-sm font-semibold text-[#285B7B]">
              Gambar QRIS Belum Diunggah
            </p>
            <p className="mt-1.5 text-xs text-[#5B686D]">
              Admin dapat mengunggah foto QRIS statis tim melalui halaman{" "}
              <strong>/admin</strong> atau menaruh file di{" "}
              <code>public/qris-koleara.png</code>.
            </p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5B686D]">
            Nominal yang harus dibayar (input manual)
          </p>
          <p className="text-2xl font-bold text-[#263238]">
            {formatIdr(amount)}
          </p>
          {config?.accountInfo ? (
            <p className="text-xs text-[#5B686D]">{config.accountInfo}</p>
          ) : null}
        </div>
      </div>

      <Notice title="Cara Pembayaran & Escrow Aman">
        {instructions} Dana akan <strong>ditahan oleh KOLEARA</strong> dan baru
        diteruskan ke tutor setelah sesi selesai dikonfirmasi.
      </Notice>
    </Card>
  );
}
