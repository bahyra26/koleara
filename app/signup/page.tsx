import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { Card } from "@/components/ui/Card";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <Card>
            <p className="text-sm text-neutral-600">Loading sign-up...</p>
          </Card>
        </div>
      }
    >
      <AuthForm mode="signup" />
    </Suspense>
  );
}
