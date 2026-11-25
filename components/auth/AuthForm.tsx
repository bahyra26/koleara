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
  DEMO_OTP_CODE,
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
  const { user, users, requestDemoOtp, verifyDemoOtp, logout, resetDemo } =
    useAuth();

  const returnPath = sanitizeReturnPath(rawNext, "/cari");

  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(Boolean(initialEmail));
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [normalizedEmail, setNormalizedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const emailValidation = validateItsEmail(email);
  const nameValid = mode === "login" || name.trim().length >= 2;
  const canRequestOtp = emailValidation.valid && nameValid;

  const queryWithNext = rawNext
    ? `?next=${encodeURIComponent(returnPath)}`
    : "";

  const signupWithEmailHref = `/signup?email=${encodeURIComponent(
    emailValidation.normalized || email.trim()
  )}${rawNext ? `&next=${encodeURIComponent(returnPath)}` : ""}`;

  const handleRequestOtp = (event: FormEvent) => {
    event.preventDefault();
    setEmailTouched(true);
    setFormError(null);
    setErrorCode(null);

    const result = requestDemoOtp({
      email,
      mode,
      name: mode === "signup" ? name : undefined,
    });

    if (!result.ok) {
      setFormError(result.error);
      setErrorCode(result.code ?? null);
      return;
    }

    setNormalizedEmail(result.data.email);
    setOtp("");
    setStep("otp");
  };

  const handleVerifyOtp = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setErrorCode(null);

    const result = verifyDemoOtp({
      email: normalizedEmail,
      otp,
      mode,
      name: mode === "signup" ? name : undefined,
    });

    if (!result.ok) {
      setFormError(result.error);
      setErrorCode(result.code ?? null);
      return;
    }

    router.push(returnPath);
  };

  if (user) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Card className="space-y-4">
          <div className="space-y-1">
            <Badge variant="outline">Sesi Demo Aktif</Badge>
            <h1 className="text-xl font-semibold text-neutral-900">
              Anda sudah masuk sebagai {user.name}
            </h1>
            <p className="text-sm text-neutral-600">
              {user.email} (
              {user.role === "tutor" ? "Tutor Demo" : "Mahasiswa Demo"})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(returnPath)}>
              Lanjutkan ({returnPath})
            </Button>
            <Button variant="outline" onClick={() => logout()}>
              Keluar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetDemo();
                router.push("/");
              }}
            >
              Reset Demo
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card className="space-y-5">
        <div className="space-y-1">
          <Badge variant="outline">Autentikasi Simulasi — Mode Demo</Badge>
          <h1 className="text-xl font-semibold text-neutral-900">
            {mode === "login"
              ? "Masuk ke KOLEARA (Demo)"
              : "Daftar Akun Mahasiswa ITS (Demo)"}
          </h1>
          <p className="text-sm text-neutral-600">
            {mode === "login"
              ? "Masukkan email ITS demo yang sudah terdaftar untuk menerima kode OTP simulasi."
              : "Buat profil demo lokal dengan 10 digit NRP dan domain @student.its.ac.id."}
          </p>
        </div>

        {rawNext ? (
          <Notice>
            Setelah masuk, Anda akan diarahkan kembali ke{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-xs">
              {returnPath}
            </code>
            .
          </Notice>
        ) : null}

        {step === "credentials" ? (
          <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
            {mode === "signup" ? (
              <Input
                id={`auth-${mode}-name`}
                label="Nama Lengkap (Sintetik / Demo)"
                type="text"
                autoComplete="name"
                placeholder="Contoh: Ardi Pratama"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                error={
                  name.length > 0 && name.trim().length < 2
                    ? "Nama lengkap minimal 2 karakter."
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
              placeholder="0000000001@student.its.ac.id"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTouched(true);
                setFormError(null);
                setErrorCode(null);
              }}
              onBlur={() => setEmailTouched(true)}
              helperText="Format wajib: 10 digit NRP + @student.its.ac.id. Spasi dan huruf kapital dinormalisasi otomatis."
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
                      Daftar akun demo dengan email ini
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
                      Masuk di halaman Login
                    </Link>
                  </p>
                ) : null}
              </Notice>
            ) : null}

            <Button type="submit" fullWidth disabled={!canRequestOtp}>
              Lanjut ke OTP Demo
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
            <Notice title="Kode OTP Simulasi (Hanya Demo)" tone="emphasis">
              <p>
                Tidak ada email yang dikirim. Masukkan kode OTP demo berikut
                untuk melanjutkan sebagai{" "}
                <strong className="break-all">{normalizedEmail}</strong>:
              </p>
              <p className="mt-2 font-mono text-lg font-bold tracking-widest text-neutral-900">
                {DEMO_OTP_CODE}
              </p>
            </Notice>

            <Input
              id={`auth-${mode}-otp`}
              label="Masukkan Kode OTP Demo (6 digit)"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
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
                disabled={otp.trim().length === 0}
              >
                Verifikasi &amp; Masuk (Demo)
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
                Ubah Email
              </Button>
            </div>
          </form>
        )}

        <div className="border-t border-neutral-200 pt-4 text-sm text-neutral-600">
          {mode === "login" ? (
            <p>
              Belum punya profil demo?{" "}
              <Link
                href={`/signup${queryWithNext}`}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                Daftar Demo
              </Link>
            </p>
          ) : (
            <p>
              Sudah punya akun demo?{" "}
              <Link
                href={`/login${queryWithNext}`}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                Masuk (Login)
              </Link>
            </p>
          )}
        </div>
      </Card>

      {mode === "login" && step === "credentials" ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Pilih Profil Demo Bawaan (Isi Cepat)
          </h2>
          <p className="text-xs text-neutral-600">
            Klik salah satu profil sintetik di bawah untuk mengisi email secara
            otomatis (tetap melewati verifikasi OTP demo {DEMO_OTP_CODE}).
          </p>
          <div className="space-y-2">
            {users.slice(0, 4).map((demoUser) => (
              <button
                key={demoUser.id}
                type="button"
                onClick={() => {
                  setEmail(demoUser.email);
                  setEmailTouched(true);
                  setFormError(null);
                  setErrorCode(null);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs hover:bg-neutral-100 cursor-pointer"
              >
                <div>
                  <p className="font-medium text-neutral-900">{demoUser.name}</p>
                  <p className="font-mono text-neutral-600">{demoUser.email}</p>
                </div>
                <Badge variant="muted">
                  {demoUser.role === "tutor" ? "Tutor" : "Mahasiswa"}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Notice>
        <strong>Batasan Prototipe:</strong> Validasi email dan OTP demo ini
        hanya simulasi antarmuka. Sistem tidak menyimpan password, tidak
        mengirim email, dan tidak membuktikan status mahasiswa ITS atau
        kepemilikan kotak masuk.
      </Notice>
    </div>
  );
}
