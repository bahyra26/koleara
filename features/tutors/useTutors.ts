"use client";

import { useMemo } from "react";
import type { TutorSearchFilters } from "@/lib/contracts";
import { courseService, tutorService } from "@/lib/mock";
import {
  useDemoHydrated,
  useDemoState,
} from "@/features/demo/DemoStoreProvider";

export function useCourses() {
  const state = useDemoState();
  return useMemo(() => state.courses, [state.courses]);
}

export function useTutorSearch(filters: TutorSearchFilters) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();
  const { query, courseId, topic, maxBudget, scheduleQuery } = filters;

  const results = useMemo(() => {
    void state.tutors;
    void state.courses;
    return tutorService.search({
      query,
      courseId,
      topic,
      maxBudget,
      scheduleQuery,
    });
  }, [
    state.tutors,
    state.courses,
    query,
    courseId,
    topic,
    maxBudget,
    scheduleQuery,
  ]);

  const topics = useMemo(() => {
    void state.courses;
    return courseService.getTopics(courseId || undefined);
  }, [state.courses, courseId]);

  return {
    hydrated,
    courses: state.courses,
    topics,
    results,
  };
}

export function useTutorProfile(tutorId: string) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const tutor = useMemo(() => {
    void state.tutors;
    return tutorService.getById(tutorId);
  }, [state.tutors, tutorId]);

  const courses = useMemo(() => {
    if (!tutor) return [];
    const byId = new Map(state.courses.map((c) => [c.id, c]));
    return tutor.courseIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [tutor, state.courses]);

  return {
    hydrated,
    tutor,
    courses,
  };
}

export function useTutorApplications(userId: string | null) {
  const state = useDemoState();
  const hydrated = useDemoHydrated();

  const applications = useMemo(() => {
    if (!userId) return [];
    void state.tutorApplications;
    return tutorService.listApplications(userId);
  }, [state.tutorApplications, userId]);

  return {
    hydrated,
    courses: state.courses,
    applications,
    submitApplication: tutorService.submitApplication,
  };
}
