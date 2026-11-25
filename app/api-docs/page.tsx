import type { Metadata } from "next";
import { SwaggerDocsView } from "@/components/docs/SwaggerDocsView";

export const metadata: Metadata = {
  title: "API Docs (Swagger / OpenAPI) — KOLEARA Convex Backend",
  description:
    "Dokumentasi interaktif Swagger / OpenAPI 3.0 untuk seluruh endpoint Query dan Mutation Convex KOLEARA.",
};

export default function ApiDocsPage() {
  return <SwaggerDocsView />;
}
