import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { Footer } from "@/components/layout/Footer";
import { Header, HeaderFallback } from "@/components/layout/Header";
import { DemoStoreProvider } from "@/features/demo/DemoStoreProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KOLEARA — Peer Tutoring ITS (Prototipe Frontend)",
  description:
    "Prototipe frontend-only marketplace peer tutoring mahasiswa ITS untuk Kalkulus 1 dan Fisika Dasar 1.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <DemoStoreProvider>
          <DemoBanner />
          <Suspense fallback={<HeaderFallback />}>
            <Header />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
            {children}
          </main>
          <Footer />
        </DemoStoreProvider>
      </body>
    </html>
  );
}
