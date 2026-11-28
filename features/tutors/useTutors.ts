"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  Course,
  LanguageCode,
  TutorLocation,
  TutorSearchFilters,
  TutorSearchResult,
} from "@/lib/contracts";
import { useAuth } from "@/features/auth/useAuth";

export function useCourses(): Course[] {
  const courses = useQuery(api.tutors.listCourses, {});
  return useMemo(() => courses ?? [], [courses]);
}

export function useTutorSearch(filters: TutorSearchFilters) {
  const coursesQuery = useQuery(api.tutors.listCourses, {});
  const topicsQuery = useQuery(api.tutors.getTopics, {
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
  });
  const searchQuery = useQuery(api.tutors.searchTutors, {
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
    ...(filters.maxBudget !== undefined ? { maxBudget: filters.maxBudget } : {}),
    ...(filters.scheduleQuery ? { scheduleQuery: filters.scheduleQuery } : {}),
    ...(filters.location ? { location: filters.location } : {}),
    ...(filters.language ? { language: filters.language } : {}),
  });

  const hydrated =
    coursesQuery !== undefined &&
    topicsQuery !== undefined &&
    searchQuery !== undefined;

  return {
    hydrated,
    courses: coursesQuery ?? [],
    topics: topicsQuery ?? [],
    results: (searchQuery ?? []) as TutorSearchResult[],
  };
}

export function useTutorProfile(tutorId: string) {
  const tutorQuery = useQuery(
    api.tutors.getTutorById,
    tutorId ? { tutorId } : "skip"
  );
  const coursesQuery = useQuery(api.tutors.listCourses, {});
  const reviewsQuery = useQuery(
    api.reviews.listTutorReviews,
    tutorId ? { tutorId, limit: 20 } : "skip"
  );

  // Stable 14-day window rounded to the hour so Convex query args stay memoized
  const [windowBounds] = useState(() => {
    const hourMs = 60 * 60 * 1000;
    const nowHour = Math.floor(Date.now() / hourMs) * hourMs;
    return {
      fromMs: nowHour,
      toMs: nowHour + 14 * 24 * hourMs,
    };
  });

  const busySlotsQuery = useQuery(
    api.bookings.getTutorBusySlots,
    tutorId
      ? { tutorId, fromMs: windowBounds.fromMs, toMs: windowBounds.toMs }
      : "skip"
  );

  const tutor = tutorQuery ?? null;
  const courses = useMemo<Course[]>(() => {
    if (!tutor || !coursesQuery) return [];
    const byId = new Map<string, Course>(coursesQuery.map((c) => [c.id, c]));
    const matched: Course[] = [];
    for (const id of tutor.courseIds) {
      const course = byId.get(id);
      if (course) matched.push(course);
    }
    return matched;
  }, [tutor, coursesQuery]);

  return {
    hydrated: tutorQuery !== undefined && coursesQuery !== undefined,
    tutor,
    courses,
    reviews: reviewsQuery ?? [],
    busySlots: busySlotsQuery ?? [],
  };
}

export function useTutorApplications() {
  const { user, sessionToken, hydrated: authHydrated } = useAuth();
  const coursesQuery = useQuery(api.tutors.listCourses, {});
  const appsQuery = useQuery(
    api.tutors.listApplications,
    user && sessionToken ? { userId: user.id, sessionToken } : "skip"
  );
  const submitMutation = useMutation(api.tutors.submitApplication);

  const submitApplication = useCallback(
    async (input: {
      name: string;
      department?: string;
      cohort?: number;
      courseIds: string[];
      topics: string[];
      bio: string;
      hourlyRate: number;
      teachingMode?: TutorLocation;
      campusSpots?: string[];
      languages?: LanguageCode[];
      slots: string[];
      proofStorageId?: Id<"_storage">;
      proofFileName?: string;
      payoutBankOrWallet?: string;
      payoutAccountName?: string;
      payoutAccountNumber?: string;
    }) => {
      if (!user || !sessionToken) {
        return {
          ok: false as const,
          code: "UNAUTHORIZED",
          error: "Silakan login terlebih dahulu.",
        };
      }
      return await submitMutation({
        sessionToken,
        userId: user.id,
        ...input,
      });
    },
    [user, sessionToken, submitMutation]
  );

  return {
    hydrated: authHydrated && coursesQuery !== undefined,
    courses: coursesQuery ?? [],
    applications: appsQuery ?? [],
    submitApplication,
  };
}
