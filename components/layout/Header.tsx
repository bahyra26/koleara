"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/useAuth";
import { useConversations } from "@/features/chat/useChat";

export function HeaderFallback() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-neutral-900"
          >
            KOLEARA
          </Link>
          <nav aria-label="Navigasi utama" className="flex items-center gap-1">
            <Link
              href="/cari"
              className="rounded-md px-2.5 py-1.5 text-sm text-neutral-700"
            >
              Cari Tutor
            </Link>
            <Link
              href="/jadi-tutor"
              className="rounded-md px-2.5 py-1.5 text-sm text-neutral-700"
            >
              Jadi Tutor
            </Link>
            <Link
              href="/chat"
              className="rounded-md px-2.5 py-1.5 text-sm text-neutral-700"
            >
              Chat
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { totalUnread } = useConversations(user?.id ?? null);

  const jadiTutorHref = user ? "/jadi-tutor" : "/login?next=%2Fjadi-tutor";

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const navLinkClass = (active: boolean) =>
    `rounded-md px-2.5 py-1.5 text-sm transition-colors ${
      active
        ? "bg-neutral-900 font-medium text-white"
        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
    }`;

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-neutral-900"
          >
            KOLEARA
          </Link>
          <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-1">
            <Link
              href="/cari"
              className={navLinkClass(
                pathname === "/cari" || pathname.startsWith("/tutor/")
              )}
            >
              Cari Tutor
            </Link>
            <Link
              href={jadiTutorHref}
              className={navLinkClass(pathname === "/jadi-tutor")}
            >
              Jadi Tutor
            </Link>
            <Link
              href={user ? "/chat" : "/login?next=%2Fchat"}
              className={navLinkClass(
                pathname === "/chat" || pathname.startsWith("/chat/")
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                Chat
                {user && totalUnread > 0 ? (
                  <Badge
                    variant={
                      pathname === "/chat" || pathname.startsWith("/chat/")
                        ? "outline"
                        : "solid"
                    }
                  >
                    {totalUnread}
                  </Badge>
                ) : null}
              </span>
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-neutral-600">
                {user.name}{" "}
                <Badge variant="muted" className="ml-1">
                  {user.role === "tutor" ? "Tutor" : "Mahasiswa"}
                </Badge>
              </span>
              <Button size="sm" variant="outline" onClick={handleLogout}>
                Keluar
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonClasses({ variant: "outline", size: "sm" })}
              >
                Login
              </Link>
              <Link href="/signup" className={buttonClasses({ size: "sm" })}>
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
