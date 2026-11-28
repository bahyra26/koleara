import { Suspense } from "react";
import { TutorProfileView } from "@/components/tutor/TutorProfileView";

export default function TutorProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-[15px] font-medium text-[#9AA4A9]">
          Loading tutor profile...
        </div>
      }
    >
      <TutorProfileView />
    </Suspense>
  );
}
