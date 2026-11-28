import { Suspense } from "react";
import { TutorSearchView } from "@/components/tutor/TutorSearchView";

export default function CariPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-[15px] font-medium text-[#9AA4A9]">
          Loading verified tutors...
        </div>
      }
    >
      <TutorSearchView />
    </Suspense>
  );
}
