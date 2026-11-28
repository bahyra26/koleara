"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/useAuth";
import { useConversations } from "@/features/chat/useChat";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/#about" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
] as const;

function HeaderBar({
  activePathname,
  rightSlot,
  mobileButton,
  mobileDrawer,
}: {
  activePathname: string | null;
  rightSlot: ReactNode;
  mobileButton?: ReactNode;
  mobileDrawer?: ReactNode;
}) {
  return (
    <header className="relative z-30">
      <div className="site-header-inner mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-5 pt-4 pb-2 sm:px-8 sm:pt-5 md:gap-6 lg:px-10 lg:pt-7 xl:pt-[60px] xl:pb-0">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-90"
        >
          <Image
            src="/logo-koleara.svg"
            alt="KOLEARA"
            width={214}
            height={104}
            priority
            className="site-logo h-12 w-auto sm:h-14 md:h-[60px] lg:h-[76px] xl:h-[clamp(84px,calc(10vw-40px),104px)]"
          />
        </Link>

        <nav
          aria-label="Main navigation"
          className="site-navigation hidden items-center gap-6 md:flex lg:gap-10 xl:gap-[clamp(36px,calc(32vw-383px),78px)] min-[1400px]:absolute min-[1400px]:left-[calc(50%-311px)]"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" && activePathname === "/";
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap text-[15px] transition-colors lg:text-[18px] xl:text-[clamp(20px,calc(2.5vw-12px),24px)] ${
                  active
                    ? "font-semibold text-[#3979A5] lg:text-[20px] xl:text-[clamp(22px,calc(2.7vw-11px),28px)] after:absolute after:bottom-[-1px] after:left-1/2 after:h-[2px] after:w-9 after:-translate-x-1/2 after:rounded-full after:bg-[#3979A5] xl:after:w-[53px]"
                    : "font-normal text-[#A3ADB1] hover:text-[#285B7B]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="site-auth hidden items-center gap-3 md:flex lg:gap-4 xl:gap-[18px] min-[1400px]:-translate-x-[2px]">
          {rightSlot}
        </div>

        {mobileButton}
      </div>
      {mobileDrawer}
    </header>
  );
}

function GuestAuthLinks() {
  return (
    <>
      <Link
        href="/login"
        className="site-login inline-flex min-h-11 items-center whitespace-nowrap px-2 text-[15px] font-semibold text-[#262626] transition-colors hover:text-[#3979A5] lg:text-[18px] xl:text-[clamp(20px,calc(2.5vw-12px),24px)]"
      >
        Login
      </Link>
      <Link
        href="/signup"
        className="site-signup inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[14px] bg-[#D99C9C] px-5 py-2 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-[#CA8989] active:translate-y-0 lg:min-h-[52px] lg:rounded-[16px] lg:px-7 lg:text-[18px] xl:min-h-[64px] xl:rounded-[17px] xl:px-[42px] xl:text-[clamp(20px,calc(2.5vw-12px),24px)]"
      >
        Sign Up
      </Link>
    </>
  );
}

export function HeaderFallback() {
  return <HeaderBar activePathname={null} rightSlot={<GuestAuthLinks />} />;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { totalUnread } = useConversations(user?.id ?? null);
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const mobileMenuOpen = menuOpenPath === pathname;

  const handleLogout = () => {
    logout();
    setMenuOpenPath(null);
    router.push("/");
  };

  return (
    <HeaderBar
      activePathname={pathname}
      rightSlot={
        user ? (
          <>
            <Link
              href="/chat"
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-2 text-[15px] font-medium text-[#285B7B] transition-colors hover:text-[#3979A5]"
            >
              <span>Chat</span>
              {totalUnread > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D99C9C] px-1.5 text-[11px] font-semibold text-white">
                  {totalUnread}
                </span>
              ) : null}
            </Link>
            <span className="max-w-[140px] truncate text-[14px] font-medium text-[#6E6E73]">
              {user.name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[14px] border border-[#D89B9B] px-5 py-2 text-[15px] font-semibold text-[#262626] transition-colors hover:bg-[#F8EEEE]"
            >
              Logout
            </button>
          </>
        ) : (
          <GuestAuthLinks />
        )
      }
      mobileButton={
        <button
          type="button"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onKeyDown={(event) => { if (event.key === "Escape") setMenuOpenPath(null); }}
          onClick={() => setMenuOpenPath(mobileMenuOpen ? null : pathname)}
          className="site-menu-toggle inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#E3E7E9] px-3.5 text-[14px] font-semibold text-[#263238] transition-colors hover:bg-[#F5F5F7] active:bg-[#EAECEF] md:hidden"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {mobileMenuOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
          <span className="hidden min-[360px]:inline">
            {mobileMenuOpen ? "Close" : "Menu"}
          </span>
        </button>
      }
      mobileDrawer={
        mobileMenuOpen ? (
          <div id="mobile-navigation" onKeyDown={(event) => { if (event.key === "Escape") { setMenuOpenPath(null); document.querySelector<HTMLButtonElement>('[aria-controls="mobile-navigation"]')?.focus(); } }} className="site-mobile-menu border-b border-[#EAEAEA] bg-white px-5 pb-5 pt-2 shadow-sm sm:px-8 md:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.href === "/" && pathname === "/";
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpenPath(null)}
                    className={`inline-flex min-h-11 items-center rounded-xl px-3 text-[16px] ${
                      active
                        ? "bg-[#EAF2F7] font-semibold text-[#3979A5]"
                        : "font-normal text-[#6E6E73] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-3 flex flex-col gap-2.5 border-t border-[#EAEAEA] pt-3">
              {user ? (
                <>
                  <Link
                    href="/chat"
                    onClick={() => setMenuOpenPath(null)}
                    className="inline-flex min-h-11 items-center justify-between rounded-xl px-3 text-[15px] font-medium text-[#285B7B]"
                  >
                    <span>Chat ({user.name})</span>
                    {totalUnread > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D99C9C] px-1.5 text-[11px] font-semibold text-white">
                        {totalUnread}
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[14px] border border-[#D89B9B] px-5 text-[15px] font-semibold text-[#262626]"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpenPath(null)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[14px] border border-[#EAEAEA] text-[16px] font-semibold text-[#262626]"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMenuOpenPath(null)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[15px] bg-[#D99C9C] text-[16px] font-semibold text-white"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null
      }
    />
  );
}
