import { Suspense } from "react";
import { TutorProfileView } from "@/components/tutor/TutorProfileView";
import { Card } from "@/components/ui/Card";

export default function TutorProfilePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <p className="text-sm text-neutral-600">Memuat profil tutor...</p>
        </Card>
      }
    >
      <TutorProfileView />
    </Suspense>
  );
}
