"use client";

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
      title="Pembayaran Berhasil Diverifikasi (Demo)"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <Link
            href={`/chat/${booking.conversationId}`}
            onClick={onClose}
            className={buttonClasses({ size: "sm" })}
          >
            Kembali ke Chat
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="solid">Lunas (Simulasi Demo)</Badge>
          <span className="text-xs text-neutral-500">
            Status tersimpan di localStorage
          </span>
        </div>

        <p className="text-sm text-neutral-700">
          Simulasi verifikasi admin berhasil. Sesi belajar Anda telah tercatat
          sebagai terbayar pada prototipe ini.
        </p>

        <dl className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Tutor</dt>
            <dd className="font-medium text-neutral-900">{tutor.name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Mata Kuliah</dt>
            <dd className="font-medium text-neutral-900">{course.name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Topik</dt>
            <dd className="font-medium text-neutral-900">{booking.topic}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-neutral-500">Jadwal</dt>
            <dd className="font-medium text-neutral-900">
              {formatWibDateTime(booking.startAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-neutral-200 pt-1.5">
            <dt className="font-medium text-neutral-700">Total</dt>
            <dd className="font-bold text-neutral-900">
              {formatIdr(payment.amount)}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
