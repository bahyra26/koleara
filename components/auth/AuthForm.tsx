"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import {
  MAX_NAME_LENGTH,
  sanitizeReturnPath,
  validateItsEmail,
} from "@/lib/validators";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const searchParams = useSearchParams();
  return (
    <AuthFormContent
      key={`${mode}:${searchParams.toString()}`}
      mode={mode}
      rawNext={searchParams.get("next")}
      initialEmail={searchParams.get("email") ?? ""}
    />
  );
}

function AuthFormContent({
  mode,
  rawNext,
  initialEmail,
}: {
  mode: "login" | "signup";
  rawNext: string | null;
  initialEmail: string;
}) {
  const router = useRouter();
  const { user, requestEmailOtp, verifyEmailOtp, logout } = useAuth();

  const returnPath = sanitizeReturnPath(rawNext, "/cari");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(Boolean(initialEmail));
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"resend" | "demo">("resend");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const emailValidation = validateItsEmail(email);
  const trimmedNameLen = name.trim().length;
  const nameValid =
    mode === "login" ||
    (trimmedNameLen >= 2 && trimmedNameLen <= MAX_NAME_LENGTH);
  const canRequestOtp = emailValidation.valid && nameValid && !submitting;

  const queryWithNext = rawNext
    ? `?next=${encodeURIComponent(returnPath)}`
    : "";

  const signupWithEmailHref = `/signup?email=${encodeURIComponent(
    emailValidation.normalized || email.trim()
  )}${rawNext ? `&next=${encodeURIComponent(returnPath)}` : ""}`;

  const handleRequestOtp = async (event: FormEvent) => {
    event.preventDefault();
    setEmailTouched(true);
    setFormError(null);
    setErrorCode(null);
    setSubmitting(true);

    const result = await requestEmailOtp({
      email,
      mode,
      name: mode === "signup" ? name : undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      setErrorCode(result.code ?? null);
      return;
    }

    setNormalizedEmail(result.data.email);
    setDeliveryMode(result.data.delivery);
    setDevOtpHint(result.data.demoOtp ?? null);
    setOtp("");
    setStep("otp");
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setErrorCode(null);
    setSubmitting(true);

    const result = await verifyEmailOtp({
      email: normalizedEmail,
      otp,
      mode,
      name: mode === "signup" ? name : undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      setErrorCode(result.code ?? null);
      return;
    }

    const signedUser = result.data.user;
    if (
      !signedUser.onboardedAt &&
      !signedUser.isAdmin &&
      signedUser.role !== "admin"
    ) {
      router.push(`/onboarding?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    router.push(returnPath);
  };

  if (user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-4">
        <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
          <div className="space-y-1">
            <Badge variant="outline">Sesi ITS Aktif</Badge>
            <h1 className="text-xl font-semibold text-[#263238]">
              Masuk sebagai {user.name}
            </h1>
            <p className="text-sm text-[#5B686D]">
              {user.email} ({user.role === "admin" ? "Admin" : user.role === "tutor" ? "Tutor ITS" : "Mahasiswa ITS"})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(returnPath)}>
              Lanjutkan ({returnPath})
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
              }}
            >
              Keluar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <Card className="space-y-5 rounded-[24px] border-[#CBD6DE] p-6">
        <div className="space-y-1">
          <Badge variant="outline">Verifikasi Mahasiswa ITS</Badge>
          <h1 className="text-xl font-semibold text-[#263238]">
            {mode === "login"
              ? "Masuk ke KOLEARA"
              : "Daftar Akun Mahasiswa ITS"}
          </h1>
          <p className="text-sm text-[#5B686D]">
            {mode === "login"
              ? "Masukkan email mahasiswa ITS Anda untuk menerima kode OTP 6 digit."
              : "Gunakan email resmi 10 digit NRP @student.its.ac.id untuk verifikasi otomatis."}
          </p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
            {mode === "signup" ? (
              <Input
                id={`auth-${mode}-name`}
                label="Nama Lengkap"
                type="text"
                autoComplete="name"
                placeholder="Contoh: Ardi Pratama"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                error={
                  name.length > 0 && !nameValid
                    ? `Nama lengkap wajib 2–${MAX_NAME_LENGTH} karakter.`
                    : undefined
                }
                required
              />
            ) : null}

            <Input
              id={`auth-${mode}-email`}
              label="Email Mahasiswa ITS"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="5025261001@student.its.ac.id"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTouched(true);
                setFormError(null);
                setErrorCode(null);
              }}
              onBlur={() => setEmailTouched(true)}
              helperText="Format wajib: 10 digit NRP + @student.its.ac.id."
              error={
                emailTouched && !emailValidation.valid
                  ? emailValidation.error
                  : undefined
              }
              required
            />

            {formError ? (
              <Notice tone="emphasis" role="alert">
                <p>{formError}</p>
                {errorCode === "USER_NOT_FOUND" ? (
                  <p className="mt-2">
                    <Link
                      href={signupWithEmailHref}
                      className="font-semibold underline underline-offset-4"
                    >
                      Daftar dengan email ini
                    </Link>
                  </p>
                ) : null}
                {errorCode === "EMAIL_EXISTS" ? (
                  <p className="mt-2">
                    <Link
                      href={`/login?email=${encodeURIComponent(
                        emailValidation.normalized
                      )}${rawNext ? `&next=${encodeURIComponent(returnPath)}` : ""}`}
                      className="font-semibold underline underline-offset-4"
                    >
                      Ke halaman Login
                    </Link>
                  </p>
                ) : null}
              </Notice>
            ) : null}

            <Button type="submit" fullWidth disabled={!canRequestOtp}>
              {submitting ? "Mengirim Kode OTP..." : "Kirim Kode OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
            {deliveryMode === "resend" ? (
              <Notice title="Kode OTP Terkirim ke Email ITS">
                <p>
                  Kami telah mengirim kode 6 digit ke{" "}
                  <strong className="break-all">{normalizedEmail}</strong>.
                  Periksa <strong>Inbox</strong> atau folder{" "}
                  <strong>Junk</strong> di Outlook ITS Anda (berlaku 10 menit).
                </p>
              </Notice>
            ) : (
              <Notice title="Kode OTP Verifikasi (Mode Pengembangan)" tone="emphasis">
                <p>
                  Server email Resend belum dikonfigurasi pada environment ini.
                  Gunakan kode OTP berikut untuk{" "}
                  <strong className="break-all">{normalizedEmail}</strong>:
                </p>
                {devOtpHint ? (
                  <p className="mt-2 font-mono text-lg font-bold tracking-widest text-[#263238]">
                    {devOtpHint}
                  </p>
                ) : null}
              </Notice>
            )}

            <Input
              id={`auth-${mode}-otp`}
              label="Masukkan Kode OTP 6 Digit"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6 digit angka"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/[^\d]/g, ""));
                setFormError(null);
              }}
              required
            />

            {formError ? (
              <Notice tone="emphasis" role="alert">
                {formError}
              </Notice>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                fullWidth
                disabled={otp.trim().length !== 6 || submitting}
              >
                {submitting ? "Memverifikasi..." : "Verifikasi & Masuk"}
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setFormError(null);
                }}
              >
                Ganti Email
              </Button>
            </div>
          </form>
        )}

        <div className="border-t border-neutral-200 pt-4 text-sm text-[#5B686D]">
          {mode === "login" ? (
            <p>
              Belum punya akun KOLEARA?{" "}
              <Link
                href={`/signup${queryWithNext}`}
                className="font-semibold text-[#3979A5] underline underline-offset-4"
              >
                Daftar Sekarang
              </Link>
            </p>
          ) : (
            <p>
              Sudah punya akun?{" "}
              <Link
                href={`/login${queryWithNext}`}
                className="font-semibold text-[#3979A5] underline underline-offset-4"
              >
                Masuk
              </Link>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
