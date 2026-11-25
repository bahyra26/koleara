"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  API_ENDPOINTS_CATALOG,
  type ApiEndpointDoc,
} from "@/lib/openapi";

function EndpointRow({ endpoint }: { endpoint: ApiEndpointDoc }) {
  const [open, setOpen] = useState(false);
  const [tryOut, setTryOut] = useState(false);
  const [bodyText, setBodyText] = useState(() =>
    JSON.stringify(endpoint.defaultArgs, null, 2)
  );
  const [loading, setLoading] = useState(false);
  const [responseState, setResponseState] = useState<{
    status: number;
    durationMs: number;
    body: string;
  } | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const routePath = `/api/convex/${endpoint.module}/${endpoint.fn}`;
  const isQuery = endpoint.kind === "query";

  const handleExecute = async () => {
    setJsonError(null);
    let parsed: unknown = {};
    try {
      parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
    } catch {
      setJsonError("Format JSON pada Request Body tidak valid.");
      return;
    }

    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(routePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const elapsed = Math.round(performance.now() - start);
      const data: unknown = await res.json();
      setResponseState({
        status: res.status,
        durationMs: elapsed,
        body: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponseState({
        status: 500,
        durationMs: elapsed,
        body: JSON.stringify(
          { ok: false, error: String(err) },
          null,
          2
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex min-w-[78px] justify-center rounded px-2.5 py-1 font-mono text-xs font-bold uppercase ${
              isQuery
                ? "bg-neutral-900 text-white"
                : "border border-neutral-900 bg-neutral-100 text-neutral-900"
            }`}
          >
            {endpoint.kind}
          </span>
          <code className="font-mono text-sm font-semibold text-neutral-900">
            {endpoint.module}:{endpoint.fn}
          </code>
          <span className="hidden font-mono text-xs text-neutral-500 sm:inline">
            POST {routePath}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-600">{endpoint.summary}</span>
          <span className="font-mono text-xs text-neutral-400">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p className="text-neutral-700">{endpoint.description}</p>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Pemanggilan di React (Convex Hook)
              </p>
              <pre className="overflow-x-auto rounded-md border border-neutral-300 bg-neutral-900 p-3 font-mono text-xs text-neutral-100">
                {endpoint.reactHookSnippet}
              </pre>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Parameter Arguments (`args`)
              </p>
              {endpoint.argsDescription.length === 0 ? (
                <p className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-500">
                  Tidak memerlukan parameter (`{}`).
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-200 bg-neutral-100 text-neutral-600">
                      <tr>
                        <th className="px-2.5 py-1.5">Field</th>
                        <th className="px-2.5 py-1.5">Tipe</th>
                        <th className="px-2.5 py-1.5">Wajib</th>
                        <th className="px-2.5 py-1.5">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {endpoint.argsDescription.map((arg) => (
                        <tr key={arg.name}>
                          <td className="px-2.5 py-1.5 font-mono font-semibold text-neutral-900">
                            {arg.name}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-neutral-600">
                            {arg.type}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {arg.required ? (
                              <Badge variant="solid">Required</Badge>
                            ) : (
                              <span className="text-neutral-400">Optional</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-neutral-700">
                            {arg.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-neutral-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Interactive Playground (Try it out)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={tryOut ? "outline" : "secondary"}
                  onClick={() => setTryOut((p) => !p)}
                >
                  {tryOut ? "Tutup Editor" : "Try it out"}
                </Button>
                <Button size="sm" onClick={handleExecute} disabled={loading}>
                  {loading ? "Menjalankan..." : "Execute"}
                </Button>
              </div>
            </div>

            {tryOut ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-600">
                  Request Body JSON (`POST {routePath}`)
                </label>
                <textarea
                  rows={5}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white p-2.5 font-mono text-xs text-neutral-900"
                />
                {jsonError ? (
                  <p className="text-xs font-medium text-neutral-900">
                    {jsonError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {responseState ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800">
                    Live Response (HTTP {responseState.status})
                  </span>
                  <span className="font-mono text-neutral-500">
                    {responseState.durationMs} ms
                  </span>
                </div>
                <pre className="max-h-80 overflow-auto rounded-md border border-neutral-300 bg-neutral-900 p-3 font-mono text-xs text-neutral-100">
                  {responseState.body}
                </pre>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-xs text-neutral-500">
                  Contoh Response (`200 OK`):
                </span>
                <pre className="max-h-60 overflow-auto rounded-md border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-800">
                  {JSON.stringify(endpoint.exampleResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SwaggerDocsView() {
  const [selectedTag, setSelectedTag] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const ep of API_ENDPOINTS_CATALOG) {
      set.add(ep.tag);
    }
    return Array.from(set);
  }, []);

  const groupedEndpoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = API_ENDPOINTS_CATALOG.filter((ep) => {
      if (selectedTag !== "ALL" && ep.tag !== selectedTag) return false;
      if (!q) return true;
      return (
        ep.module.toLowerCase().includes(q) ||
        ep.fn.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, ApiEndpointDoc[]>();
    for (const ep of filtered) {
      const list = groups.get(ep.tag) ?? [];
      list.push(ep);
      groups.set(ep.tag, list);
    }
    return Array.from(groups.entries());
  }, [selectedTag, searchQuery]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="solid">OAS 3.0.3</Badge>
              <Badge variant="outline">Convex Backend API</Badge>
              <Badge variant="default">
                {API_ENDPOINTS_CATALOG.length} Endpoints
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              KOLEARA — Swagger / OpenAPI Documentation
            </h1>
            <p className="max-w-3xl text-sm text-neutral-600">
              Dokumentasi lengkap seluruh fungsi <strong>Query</strong> dan{" "}
              <strong>Mutation</strong> Convex untuk KOLEARA. Klik salah satu
              endpoint di bawah untuk melihat parameter, contoh hook React, atau
              klik <strong>Execute</strong> untuk menguji API secara langsung
              terhadap database Convex.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              Buka openapi.json
            </a>
            <Link href="/" className={buttonClasses({ size: "sm" })}>
              &larr; Kembali ke Aplikasi
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTag("ALL")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedTag === "ALL"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Semua ({API_ENDPOINTS_CATALOG.length})
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTag === tag
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="Cari fungsi (mis. searchTutors, sendMessage)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 sm:w-72"
          />
        </div>
      </Card>

      {groupedEndpoints.map(([tag, endpoints]) => (
        <section key={tag} className="space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-300 pb-2">
            <h2 className="text-lg font-bold text-neutral-900">{tag}</h2>
            <span className="text-xs font-medium text-neutral-500">
              {endpoints.length} fungsi
            </span>
          </div>
          <div className="space-y-2.5">
            {endpoints.map((ep) => (
              <EndpointRow key={ep.id} endpoint={ep} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
