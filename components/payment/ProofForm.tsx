"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";

type ProofFormProps = {
  onSubmitProof: (args: {
    proofName: string;
    proofStorageId: Id<"_storage">;
  }) => Promise<{ ok: boolean; error?: string }>;
};

export function ProofForm({ onSubmitProof }: ProofFormProps) {
  const { uploadFile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (file && file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Pilih gambar atau PDF bukti transfer QRIS terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    const uploaded = await uploadFile(selectedFile);
    if (!uploaded.ok) {
      setSubmitting(false);
      setError(uploaded.error);
      return;
    }

    const res = await onSubmitProof({
      proofName: uploaded.data.fileName,
      proofStorageId: uploaded.data.storageId,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Gagal mengirim bukti pembayaran.");
    }
  };

  return (
    <Card className="rounded-[22px] border-[#CBD6DE]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#263238]">
            Unggah Bukti Transfer QRIS
          </h3>
          <p className="mt-0.5 text-xs text-[#5B686D]">
            Unggah screenshot bukti pembayaran (JPG, PNG, WebP, atau PDF, maks.
            5 MB). Admin KOLEARA akan memverifikasi pembayaran Anda.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="proof-file-picker"
            className="text-sm font-medium text-[#263238]"
          >
            File Bukti Pembayaran
          </label>
          <input
            id="proof-file-picker"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            required
            className="block w-full rounded-xl border border-[#CBD6DE] bg-white px-3 py-2 text-xs text-[#263238] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EAF2F7] file:px-3 file:py-1.5 file:text-xs font-medium file:text-[#285B7B] hover:file:bg-[#DCEAF3]"
          />
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-xl border border-[#CBD6DE] bg-[#F8FAFB] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Preview bukti transfer"
              className="mx-auto max-h-56 rounded-lg object-contain"
            />
          </div>
        ) : null}

        {error ? (
          <Notice tone="emphasis" role="alert">
            {error}
          </Notice>
        ) : null}

        <Button
          type="submit"
          fullWidth
          disabled={!selectedFile || submitting}
        >
          {submitting
            ? "Mengunggah Bukti Transfer..."
            : "Kirim Bukti Pembayaran"}
        </Button>
      </form>
    </Card>
  );
}
