"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import type { LanguageCode } from "@/lib/contracts";
import {
  extractCohortYearFromNrp,
  extractNrpFromItsEmail,
  sanitizeReturnPath,
} from "@/lib/validators";

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = sanitizeReturnPath(searchParams.get("next"), "/cari");
  const { user, hydrated, updateOnboardingProfile } = useAuth();

  const [nameOverride, setName] = useState<string | null>(null);
  const [departmentOverride, setDepartment] = useState<string | null>(null);
  const [cohortYearOverride, setCohortYear] = useState<string | null>(null);
  const [preferredLanguageOverride, setPreferredLanguage] =
    useState<LanguageCode | null>(null);
  const [whatsappOverride, setWhatsapp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent("/onboarding")}`);
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat profil mahasiswa ITS...
      </div>
    );
  }

  const nrp = user.nrp ?? extractNrpFromItsEmail(user.email) ?? "-";
  const derivedCohort =
    nrp !== "-" ? extractCohortYearFromNrp(nrp) : undefined;
  const name = nameOverride ?? user.name ?? "";
  const department = departmentOverride ?? user.department ?? "";
  const cohortYear =
    cohortYearOverride ?? String(user.cohortYear ?? derivedCohort ?? 2026);
  const preferredLanguage: LanguageCode =
    preferredLanguageOverride ?? user.preferredLanguage ?? "id";
  const whatsapp = whatsappOverride ?? user.whatsapp ?? "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const parsedCohort = Number.parseInt(cohortYear.trim(), 10);
    const res = await updateOnboardingProfile({
      name: name.trim(),
      department: department.trim(),
      cohortYear: Number.isInteger(parsedCohort) ? parsedCohort : undefined,
      preferredLanguage,
      whatsapp: whatsapp.trim(),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    router.push(returnPath);
  };

  return (
    <div className="mx-auto max-w-lg py-6">
      <Card className="space-y-5 rounded-[26px] border-[#CBD6DE] p-6 sm:p-8">
        <div className="space-y-1">
          <Badge variant="outline">Lengkapi Profil ITS</Badge>
          <h1 className="text-2xl font-semibold text-[#263238]">
            Selamat datang di KOLEARA
          </h1>
          <p className="text-sm text-[#5B686D]">
            NRP <strong>{nrp}</strong> telah terverifikasi. Lengkapi data di
            bawah sekali saja sebelum mulai mencari tutor.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="onboarding-name"
            label="Nama Lengkap"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="onboarding-dept"
              label="Departemen ITS"
              placeholder="Contoh: Teknik Informatika"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            />
            <Input
              id="onboarding-cohort"
              label="Angkatan"
              type="number"
              min={2015}
              max={2035}
              value={cohortYear}
              onChange={(e) => setCohortYear(e.target.value)}
              helperText="Otomatis dibaca dari digit 5–6 NRP."
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-lang"
              className="block text-sm font-medium text-[#263238]"
            >
              Bahasa Pengantar Belajar
            </label>
            <select
              id="onboarding-lang"
              value={preferredLanguage}
              onChange={(e) =>
                setPreferredLanguage(e.target.value === "en" ? "en" : "id")
              }
              className="min-h-11 w-full rounded-xl border border-[#CBD6DE] bg-white px-3.5 text-sm text-[#263238]"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English (IUP / International Class)</option>
            </select>
          </div>

          <Input
            id="onboarding-whatsapp"
            label="Nomor WhatsApp Aktif"
            placeholder="0812xxxxxxxx"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            helperText="Privasi terjaga: nomor WA hanya dibagikan ke lawan sesi setelah pembayaran terverifikasi."
            required
          />

          {error ? (
            <Notice tone="emphasis" role="alert">
              {error}
            </Notice>
          ) : null}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Menyimpan Profil..." : "Simpan & Lanjutkan"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[#5B686D]">
          Memuat halaman onboarding...
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}
