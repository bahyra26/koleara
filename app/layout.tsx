import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Poppins } from "next/font/google";
import { Header, HeaderFallback } from "@/components/layout/Header";
import { DemoStoreProvider } from "@/features/demo/DemoStoreProvider";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KOLEARA — Peer Tutoring for ITS Students",
  description:
    "Find verified senior ITS tutors, share knowledge, and grow together.",
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
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_CLEANUP_SCRIPT }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-[#262626]"
      >
        <a href="#main-content" className="sr-only fixed top-3 left-3 z-50 rounded-lg bg-white px-5 py-3 text-[#285B7B] shadow-lg focus:not-sr-only">Skip to content</a>
        <DemoStoreProvider>
          <div className="site-shell flex min-h-svh flex-1 flex-col overflow-x-clip">
            <Suspense fallback={<HeaderFallback />}>
              <Header />
            </Suspense>
            <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-5 py-6 sm:px-8 lg:px-10">
              {children}
            </main>
          </div>
        </DemoStoreProvider>
      </body>
    </html>
  );
}
