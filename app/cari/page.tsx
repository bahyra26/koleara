import { Suspense } from "react";
import { TutorSearchView } from "@/components/tutor/TutorSearchView";
import { Card } from "@/components/ui/Card";

export default function CariPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <p className="text-sm text-neutral-600">Memuat daftar tutor...</p>
        </Card>
      }
    >
      <TutorSearchView />
    </Suspense>
  );
}
