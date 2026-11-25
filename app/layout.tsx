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

const EXTENSION_CLEANUP_SCRIPT = `
(function () {
  try {
    window.addEventListener(
      "unhandledrejection",
      function (e) {
        var stack = (e && e.reason && e.reason.stack) ? String(e.reason.stack) : "";
        if (stack.indexOf("chrome-extension://") !== -1) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );
    var stripAttrs = function (root) {
      if (!root || !root.querySelectorAll) return;
      var nodes = root.querySelectorAll("[bis_skin_checked],[bis_register]");
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].removeAttribute("bis_skin_checked");
        nodes[i].removeAttribute("bis_register");
      }
      if (document.body) {
        var bodyAttrs = document.body.getAttributeNames();
        for (var j = 0; j < bodyAttrs.length; j++) {
          var name = bodyAttrs[j];
          if (name.indexOf("bis_") === 0 || name.indexOf("__processed_") === 0) {
            document.body.removeAttribute(name);
          }
        }
      }
    };
    stripAttrs(document);
    var obs = new MutationObserver(function () {
      stripAttrs(document);
    });
    obs.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["bis_skin_checked", "bis_register"]
    });
    window.addEventListener("load", function () {
      stripAttrs(document);
      setTimeout(function () { obs.disconnect(); }, 2000);
    }, { once: true });
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_CLEANUP_SCRIPT }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-neutral-50 text-neutral-900"
      >
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
