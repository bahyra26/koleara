import Link from "next/link";
import type { TutorSearchResult } from "@/lib/contracts";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatIdr, getInitials } from "@/lib/formatters";

type TutorCardProps = {
  result: TutorSearchResult;
};

function verificationLabel(badge?: "grade" | "asdos"): string {
  if (badge === "asdos") return "Terverifikasi (Demo) — Asdos";
  if (badge === "grade") return "Terverifikasi (Demo) — Nilai A";
  return "Terverifikasi (Demo)";
}

export function TutorCard({ result }: TutorCardProps) {
  const { tutor, courses, matchScore, matchReasons } = result;

  return (
    <Card className="flex flex-col justify-between gap-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-sm font-semibold text-neutral-800"
            >
              {getInitials(tutor.name)}
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                {tutor.name}
              </h2>
              <p className="text-xs text-neutral-600">
                {tutor.department} ITS • Angkatan {tutor.cohort}
              </p>
            </div>
          </div>

          {typeof matchScore === "number" ? (
            <div className="text-right">
              <Badge variant="solid">Kecocokan Demo: {matchScore}%</Badge>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{verificationLabel(tutor.badge)}</Badge>
          {typeof tutor.rating === "number" ? (
            <Badge variant="muted">
              Rating Contoh: {tutor.rating.toFixed(1)}/5
            </Badge>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {courses.map((course) => (
              <Badge key={course.id} variant="default">
                {course.name}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-neutral-600">
            Topik: {tutor.topics.join(", ")}
          </p>
        </div>

        <p className="text-xs text-neutral-500">
          Jadwal contoh: {tutor.slots.join(" • ")}
        </p>

        {matchReasons.length > 0 ? (
          <p className="text-xs text-neutral-600">
            Alasan kecocokan (aturan lokal): {matchReasons.join(", ")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3">
        <div>
          <p className="text-base font-bold text-neutral-900">
            {formatIdr(tutor.hourlyRate)}
          </p>
          <p className="text-xs text-neutral-500">per sesi 60 menit</p>
        </div>
        <Link href={`/tutor/${tutor.id}`} className={buttonClasses()}>
          Lihat Profil
        </Link>
      </div>
    </Card>
  );
}
