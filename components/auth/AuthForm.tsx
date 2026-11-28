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
  const trimmedNameLen = name.trim().length;
  const nameValid =
    mode === "login" ||
    (trimmedNameLen >= 2 && trimmedNameLen <= MAX_NAME_LENGTH);
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
      <div className="mx-auto max-w-md space-y-4 py-4">
        <Card className="space-y-4">
          <div className="space-y-1">
            <Badge variant="outline">Active Demo Session</Badge>
            <h1 className="text-xl font-semibold text-neutral-900">
              Signed in as {user.name}
            </h1>
            <p className="text-sm text-neutral-600">
              {user.email} ({user.role === "tutor" ? "Demo Tutor" : "Demo Student"})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(returnPath)}>
              Continue ({returnPath})
            </Button>
            <Button variant="outline" onClick={() => logout()}>
              Log Out
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetDemo();
                router.push("/");
              }}
            >
              Reset Local Demo
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <Card className="space-y-5">
        <div className="space-y-1">
          <Badge variant="outline">Demo Authentication</Badge>
          <h1 className="text-xl font-semibold text-neutral-900">
            {mode === "login"
              ? "Sign In to KOLEARA"
              : "Create ITS Student Account"}
          </h1>
          <p className="text-sm text-neutral-600">
            {mode === "login"
              ? "Enter a registered ITS student email to receive a simulated demo OTP."
              : "Create a student profile with your 10-digit NRP and @student.its.ac.id email."}
          </p>
        </div>

        {rawNext ? (
          <Notice>
            After signing in, you will return to{" "}
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
                label="Full Name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Ardi Pratama"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                error={
                  name.length > 0 && !nameValid
                    ? `Full name must be 2–${MAX_NAME_LENGTH} characters.`
                    : undefined
                }
                required
              />
            ) : null}

            <Input
              id={`auth-${mode}-email`}
              label="ITS Student Email"
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
              helperText="Required format: 10-digit NRP + @student.its.ac.id. Spaces and uppercase letters are normalized automatically."
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
                      Sign up with this email instead
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
                      Go to Login page
                    </Link>
                  </p>
                ) : null}
              </Notice>
            ) : null}

            <Button type="submit" fullWidth disabled={!canRequestOtp}>
              Continue to Demo OTP
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
            <Notice title="Demo OTP Code" tone="emphasis">
              <p>
                No real email is sent. Enter the 6-digit demo OTP code below to
                continue as{" "}
                <strong className="break-all">{normalizedEmail}</strong>:
              </p>
              <p className="mt-2 font-mono text-lg font-bold tracking-widest text-neutral-900">
                {DEMO_OTP_CODE}
              </p>
            </Notice>

            <Input
              id={`auth-${mode}-otp`}
              label="Enter 6-Digit Demo OTP"
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
                Verify &amp; Sign In
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
                Change Email
              </Button>
            </div>
          </form>
        )}

        <div className="border-t border-neutral-200 pt-4 text-sm text-neutral-600">
          {mode === "login" ? (
            <p>
              Don&apos;t have a demo account yet?{" "}
              <Link
                href={`/signup${queryWithNext}`}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                Sign Up
              </Link>
            </p>
          ) : (
            <p>
              Already have a demo account?{" "}
              <Link
                href={`/login${queryWithNext}`}
                className="font-medium text-neutral-900 underline underline-offset-4"
              >
                Login
              </Link>
            </p>
          )}
        </div>
      </Card>

      {mode === "login" && step === "credentials" ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            Quick-Fill Demo Accounts
          </h2>
          <p className="text-xs text-neutral-600">
            Select any seeded account below to fill its email automatically
            (uses demo OTP {DEMO_OTP_CODE}).
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
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs hover:bg-neutral-100"
              >
                <div>
                  <p className="font-medium text-neutral-900">{demoUser.name}</p>
                  <p className="font-mono text-neutral-600">{demoUser.email}</p>
                </div>
                <Badge variant="muted">
                  {demoUser.role === "tutor" ? "Tutor" : "Student"}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Notice>
        <strong>Prototype Note:</strong> Email and OTP verification are
        simulated for demo purposes. No passwords are stored and no emails are
        sent.
      </Notice>
    </div>
  );
}
