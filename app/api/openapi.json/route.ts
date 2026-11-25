import { NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const spec = buildOpenApiSpec(url.origin);
  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
