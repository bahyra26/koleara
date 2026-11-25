"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";

type ProofFormProps = {
  defaultFileName?: string;
  onSubmitProof: (proofName: string) => { ok: boolean; error?: string };
};

export function ProofForm({ defaultFileName, onSubmitProof }: ProofFormProps) {
  const [proofName, setProofName] = useState(
    defaultFileName || "bukti-qris-demo.jpg"
  );
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Only read synthetic filename metadata; never read or persist file bytes
      setProofName(file.name);
      setError(null);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const res = onSubmitProof(proofName.trim() || "bukti-qris-demo.jpg");
    if (!res.ok) {
      setError(res.error ?? "Gagal mengirim bukti demo.");
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Kirim Bukti Pembayaran (Simulasi Demo)
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">
            Anda dapat menggunakan nama file sintetik atau memilih file contoh.
            Prototipe ini hanya menyimpan nama file di state lokal dan tidak
            mengunggah atau menyimpan isi file.
          </p>
        </div>

        <Input
          id="proof-filename"
          label="Nama File Bukti Demo (Opsional)"
          value={proofName}
          onChange={(e) => setProofName(e.target.value)}
          placeholder="bukti-qris-demo.jpg"
          helperText="Kosongkan untuk memakai nama standar bukti-qris-demo.jpg."
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="proof-file-picker"
            className="text-sm font-medium text-neutral-900"
          >
            Pilih File Contoh (Opsional — Hanya Membaca Nama File)
          </label>
          <input
            id="proof-file-picker"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-700 file:mr-3 file:rounded file:border-0 file:bg-neutral-200 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-neutral-900 hover:file:bg-neutral-300"
          />
        </div>

        {error ? (
          <Notice tone="emphasis" role="alert">
            {error}
          </Notice>
        ) : null}

        <Button type="submit" fullWidth>
          Kirim Bukti Pembayaran (Demo)
        </Button>
      </form>
    </Card>
  );
}
