"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  REST_ENDPOINTS_CATALOG,
  type HttpMethod,
  type RestEndpointDoc,
} from "@/lib/openapi";

function methodBadgeStyle(method: HttpMethod): string {
  switch (method) {
    case "GET":
      return "bg-neutral-900 text-white";
    case "POST":
      return "border border-neutral-900 bg-neutral-200 text-neutral-950";
    case "PATCH":
      return "border border-neutral-700 bg-white text-neutral-900";
    case "DELETE":
      return "border border-neutral-900 bg-neutral-700 text-white";
  }
}

function EndpointCard({ endpoint }: { endpoint: RestEndpointDoc }) {
  const [open, setOpen] = useState(false);
  const [tryOut, setTryOut] = useState(false);
  const [pathValues, setPathValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      endpoint.pathParams.map((p) => [p.name, p.defaultValue])
    )
  );
  const [queryValues, setQueryValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      endpoint.queryParams.map((q) => [q.name, q.defaultValue])
    )
  );
  const [bodyText, setBodyText] = useState(() =>
    endpoint.defaultBody ? JSON.stringify(endpoint.defaultBody, null, 2) : ""
  );
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [responseState, setResponseState] = useState<{
    status: number;
    durationMs: number;
    url: string;
    body: string;
  } | null>(null);

  const hasBody =
    (endpoint.method === "POST" || endpoint.method === "PATCH") &&
    endpoint.bodyFields.length > 0;

  const buildResolvedUrl = () => {
    let urlPath = endpoint.pathTemplate;
    for (const p of endpoint.pathParams) {
      const val = (pathValues[p.name] ?? p.defaultValue).trim();
      urlPath = urlPath.replace(`:${p.name}`, encodeURIComponent(val));
    }
    const qs = new URLSearchParams();
    for (const q of endpoint.queryParams) {
      const val = (queryValues[q.name] ?? "").trim();
      if (val !== "") {
        qs.set(q.name, val);
      }
    }
    const queryStr = qs.toString();
    return queryStr ? `${urlPath}?${queryStr}` : urlPath;
  };

  const handleExecute = async () => {
    setJsonError(null);
    let requestBody: string | undefined;

    if (hasBody) {
      try {
        const parsed = bodyText.trim() ? JSON.parse(bodyText) : {};
        requestBody = JSON.stringify(parsed);
      } catch {
        setJsonError("Format JSON pada Request Body tidak valid.");
        return;
      }
    }

    const targetUrl = buildResolvedUrl();
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(targetUrl, {
        method: endpoint.method,
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: requestBody,
      });
      const elapsed = Math.round(performance.now() - start);
      const data: unknown = await res.json();
      setResponseState({
        status: res.status,
        durationMs: elapsed,
        url: `${endpoint.method} ${targetUrl}`,
        body: JSON.stringify(data, null, 2),
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponseState({
        status: 500,
        durationMs: elapsed,
        url: `${endpoint.method} ${targetUrl}`,
        body: JSON.stringify({ success: false, message: String(err) }, null, 2),
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
            className={`inline-flex min-w-[68px] justify-center rounded px-2.5 py-1 font-mono text-xs font-bold uppercase ${methodBadgeStyle(
              endpoint.method
            )}`}
          >
            {endpoint.method}
          </span>
          <code className="font-mono text-sm font-semibold text-neutral-900">
            {endpoint.pathTemplate}
          </code>
          <span className="font-medium text-neutral-700">
            — {endpoint.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-neutral-500 md:inline">
            {endpoint.summary}
          </span>
          <span className="font-mono text-xs text-neutral-400">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-neutral-700">{endpoint.description}</p>
            <Badge variant="outline">Convex: {endpoint.convexFunction}</Badge>
          </div>

          {endpoint.pathParams.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Path Parameters (`params:path`)
              </p>
              <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-3 py-1.5">Parameter</th>
                      <th className="px-3 py-1.5">Contoh / Nilai Uji</th>
                      <th className="px-3 py-1.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {endpoint.pathParams.map((p) => (
                      <tr key={p.name}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-neutral-900">
                          :{p.name}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={pathValues[p.name] ?? ""}
                            onChange={(e) =>
                              setPathValues((prev) => ({
                                ...prev,
                                [p.name]: e.target.value,
                              }))
                            }
                            className="w-48 rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-900"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-neutral-700">
                          {p.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {endpoint.queryParams.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Query Parameters (`params:query`)
              </p>
              <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-3 py-1.5">Query</th>
                      <th className="px-3 py-1.5">Wajib</th>
                      <th className="px-3 py-1.5">Nilai Uji</th>
                      <th className="px-3 py-1.5">Nilai / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {endpoint.queryParams.map((q) => (
                      <tr key={q.name}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-neutral-900">
                          {q.name}
                        </td>
                        <td className="px-3 py-1.5">
                          {q.required ? (
                            <Badge variant="solid">Wajib</Badge>
                          ) : (
                            <span className="text-neutral-500">Opsional</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            placeholder="(kosong)"
                            value={queryValues[q.name] ?? ""}
                            onChange={(e) =>
                              setQueryValues((prev) => ({
                                ...prev,
                                [q.name]: e.target.value,
                              }))
                            }
                            className="w-44 rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-900"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-neutral-700">
                          {q.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {endpoint.bodyFields.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Request Body (`body:json`)
              </p>
              <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-100 text-neutral-600">
                    <tr>
                      <th className="px-3 py-1.5">Field</th>
                      <th className="px-3 py-1.5">Tipe</th>
                      <th className="px-3 py-1.5">Wajib</th>
                      <th className="px-3 py-1.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {endpoint.bodyFields.map((f) => (
                      <tr key={f.name}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-neutral-900">
                          {f.name}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-neutral-600">
                          {f.type}
                        </td>
                        <td className="px-3 py-1.5">
                          {f.required ? (
                            <Badge variant="solid">Wajib</Badge>
                          ) : (
                            <span className="text-neutral-500">Opsional</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-neutral-700">
                          {f.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Kode Status HTTP
            </p>
            <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-200 bg-neutral-100 text-neutral-600">
                  <tr>
                    <th className="w-24 px-3 py-1.5">Kode</th>
                    <th className="px-3 py-1.5">Kapan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {endpoint.statusCodes.map((sc) => (
                    <tr key={sc.code}>
                      <td className="px-3 py-1.5 font-mono font-bold text-neutral-900">
                        {sc.code}
                      </td>
                      <td className="px-3 py-1.5 text-neutral-700">
                        {sc.when}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 border-t border-neutral-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-mono text-xs text-neutral-600">
                {endpoint.method} {buildResolvedUrl()}
              </code>
              <div className="flex items-center gap-2">
                {hasBody ? (
                  <Button
                    size="sm"
                    variant={tryOut ? "outline" : "secondary"}
                    onClick={() => setTryOut((p) => !p)}
                  >
                    {tryOut ? "Tutup JSON Body" : "Edit JSON Body"}
                  </Button>
                ) : null}
                <Button size="sm" onClick={handleExecute} disabled={loading}>
                  {loading ? "Mengirim..." : `Send ${endpoint.method}`}
                </Button>
              </div>
            </div>

            {hasBody && tryOut ? (
              <div className="space-y-1.5">
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
                  <span className="font-semibold text-neutral-900">
                    Live Response — HTTP {responseState.status} (
                    {responseState.url})
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
                  Contoh Response JSON:
                </span>
                <pre className="max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white p-3 font-mono text-xs text-neutral-800">
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
    for (const ep of REST_ENDPOINTS_CATALOG) {
      set.add(ep.tag);
    }
    return Array.from(set);
  }, []);

  const groupedEndpoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = REST_ENDPOINTS_CATALOG.filter((ep) => {
      if (selectedTag !== "ALL" && ep.tag !== selectedTag) return false;
      if (!q) return true;
      return (
        ep.name.toLowerCase().includes(q) ||
        ep.pathTemplate.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, RestEndpointDoc[]>();
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
              <Badge variant="solid">OpenAPI 3.0.3</Badge>
              <Badge variant="outline">REST + Bruno Collection</Badge>
              <Badge variant="default">
                {REST_ENDPOINTS_CATALOG.length} Endpoints
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              KOLEARA API Docs (Swagger &amp; Bruno)
            </h1>
            <p className="max-w-3xl text-sm text-neutral-600">
              Dokumentasi REST API standar (<strong>GET</strong>,{" "}
              <strong>POST</strong>, <strong>PATCH</strong>,{" "}
              <strong>DELETE</strong>) dengan parameter path, query, dan JSON
              body yang selaras dengan koleksi Bruno di folder{" "}
              <code>bruno/</code>.
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
              Semua ({REST_ENDPOINTS_CATALOG.length})
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
            placeholder="Cari endpoint (mis. GET /api/tutors)..."
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
              {endpoints.length} endpoint
            </span>
          </div>
          <div className="space-y-2.5">
            {endpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
