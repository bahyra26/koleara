import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          KOLEARA — Prototipe Peer Tutoring Mahasiswa ITS (Convex Backend).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/api-docs"
            className="font-medium text-neutral-800 underline underline-offset-4 hover:text-neutral-950"
          >
            Swagger API Docs (/api-docs)
          </Link>
          <span>•</span>
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-neutral-800"
          >
            openapi.json
          </a>
        </div>
      </div>
    </footer>
  );
}
