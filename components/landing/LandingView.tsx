"use client";

import Image from "next/image";
import Link from "next/link";
import "./LandingView.css";
import { useAuth } from "@/features/auth/useAuth";

const HERO_STATS = [
  {
    value: "71,1%",
    description: "Freshmen feel that physics is the most difficult course.",
  },
  {
    value: "7 out of 15",
    description: "Freshmen fail to find or secure a tutor.",
  },
  {
    value: "94,7%",
    description: "Freshmen have tried AI but still struggle.",
  },
] as const;

export function LandingView() {
  const { user } = useAuth();
  const becomeTutorHref = user ? "/jadi-tutor" : "/login?next=%2Fjadi-tutor";

  return (
    <>
      <section
        data-landing
        aria-labelledby="hero-heading"
        className="landing-hero"
      >
        <div className="landing-stage">
          {/* Left Copy & Actions */}
          <div className="landing-copy">
            <h1
              id="hero-heading"
              className="landing-heading"
            >
              Learning{" "}
              <span className="landing-blue">Together</span> Starts
              <br className="hidden sm:inline" /> with{" "}
              <span className="landing-rose">Connection</span>
            </h1>

            <p className="landing-description">
              Find your partner, share knowledge, and grow together.
            </p>

            <div className="landing-actions">
              <Link
                href="/cari"
                className="landing-primary"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span>Find a Tutor</span>
              </Link>

              <Link
                href={becomeTutorHref}
                className="landing-secondary"
              >
                <span>Become a Tutor</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right Concentric Rings & Cutout Students */}
          <div className="landing-visual">
            {/* Concentric ring arcs */}
            <div aria-hidden="true" className="landing-rings" />

            <div className="relative z-10 w-full">
              <Image
                src="/hero-actors.webp"
                alt="Two ITS students discussing a coursebook together"
                width={1206}
                height={1055}
                preload
                unoptimized
                sizes="(min-width: 1400px) 760px, (min-width: 1200px) 680px, (min-width: 768px) 640px, 100vw"
                className="landing-actors"
              />
            </div>

            {/* Smooth bottom fade across both cutout and concentric rings */}
            <div
              aria-hidden="true"
              className="landing-fade"
            />
          </div>

          {/* Floating Survey Stats Card Tray */}
          <div className="landing-stats">
            <div>
              <div className="landing-statGrid">
                {HERO_STATS.map((stat) => (
                  <div
                    key={stat.value}
                    className="landing-stat"
                  >
                    <p className="landing-value">
                      {stat.value}
                    </p>
                    <p className="landing-statDescription">
                      {stat.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
