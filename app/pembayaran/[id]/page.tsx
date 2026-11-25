import { Suspense } from "react";
import { CheckoutView } from "@/components/payment/CheckoutView";
import { Card } from "@/components/ui/Card";

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <p className="text-sm text-neutral-600">Memuat halaman checkout...</p>
        </Card>
      }
    >
      <CheckoutView />
    </Suspense>
  );
}
