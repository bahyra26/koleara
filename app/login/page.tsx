import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <Card>
            <p className="text-sm text-neutral-600">Loading sign-in...</p>
          </Card>
        </div>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
