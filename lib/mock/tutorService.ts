import type {
  Course,
  ServiceResult,
  Tutor,
  TutorApplication,
  TutorSearchFilters,
  TutorSearchResult,
} from "@/lib/contracts";
import {
  createSyntheticId,
  getConvexMutationHandlers,
  getDemoStateSnapshot,
  updateDemoState,
} from "@/lib/mock/store";
import { validateTutorApplicationInput } from "@/lib/validators";

export const courseService = {
  list(): Course[] {
    return getDemoStateSnapshot().courses;
  },

  getTopics(courseId?: string): string[] {
    const courses = getDemoStateSnapshot().courses;
    if (courseId) {
      const course = courses.find((c) => c.id === courseId);
      return course ? [...course.topics] : [];
    }
    const seen = new Set<string>();
    const topics: string[] = [];
    for (const course of courses) {
      for (const topic of course.topics) {
        if (!seen.has(topic)) {
          seen.add(topic);
          topics.push(topic);
        }
      }
    }
    return topics;
  },
};

export const tutorService = {
  list(): Tutor[] {
    return getDemoStateSnapshot().tutors.filter((t) => t.verified);
  },

  getById(tutorId: string): Tutor | null {
    return (
      getDemoStateSnapshot().tutors.find(
        (t) => t.id === tutorId && t.verified
      ) ?? null
    );
  },

  search(filters: TutorSearchFilters): TutorSearchResult[] {
    const state = getDemoStateSnapshot();
    const courseById = new Map(state.courses.map((c) => [c.id, c]));

    const query = (filters.query ?? "").trim().toLowerCase();
    const courseId = (filters.courseId ?? "").trim();
    const topic = (filters.topic ?? "").trim().toLowerCase();
    const maxBudget =
      typeof filters.maxBudget === "number" &&
      Number.isFinite(filters.maxBudget) &&
      filters.maxBudget >= 0
        ? filters.maxBudget
        : null;
    const scheduleQuery = (filters.scheduleQuery ?? "").trim().toLowerCase();

    const hasActiveFilter = Boolean(
      query || courseId || topic || maxBudget !== null || scheduleQuery
    );

    const results: TutorSearchResult[] = [];

    for (const tutor of state.tutors) {
      if (!tutor.verified) continue;

      const tutorCourses = tutor.courseIds
        .map((id) => courseById.get(id))
        .filter((c): c is Course => Boolean(c));

      if (courseId && !tutor.courseIds.includes(courseId)) continue;
      if (topic && !tutor.topics.some((t) => t.toLowerCase().includes(topic))) {
        continue;
      }
      if (maxBudget !== null && tutor.hourlyRate > maxBudget) continue;
      if (
        scheduleQuery &&
        !tutor.slots.some((slot) => slot.toLowerCase().includes(scheduleQuery))
      ) {
        continue;
      }

      if (query) {
        const haystack = [
          tutor.name,
          tutor.department,
          tutor.bio,
          ...tutorCourses.map((c) => c.name),
          ...tutor.topics,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      if (!hasActiveFilter) {
        results.push({ tutor, courses: tutorCourses, matchReasons: [] });
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      let topicScore = 22;
      if (topic) {
        const exactTopic = tutor.topics.some((t) => t.toLowerCase() === topic);
        topicScore = exactTopic ? 40 : 32;
        reasons.push("Topik cocok");
      } else if (query) {
        const matchesTopic = tutor.topics.some((t) =>
          t.toLowerCase().includes(query)
        );
        const matchesName = tutor.name.toLowerCase().includes(query);
        topicScore = matchesTopic ? 38 : matchesName ? 35 : 28;
        reasons.push("Kata kunci cocok");
      } else if (courseId) {
        topicScore = 34;
        reasons.push("Mata kuliah cocok");
      }
      score += topicScore;

      const badgePts = tutor.badge === "asdos" ? 15 : 12;
      const ratingPts = Math.round(((tutor.rating ?? 4.5) / 5) * 10);
      score += Math.min(25, badgePts + ratingPts);

      if (maxBudget !== null) {
        const ratio = maxBudget > 0 ? tutor.hourlyRate / maxBudget : 1;
        score += ratio <= 0.75 ? 20 : ratio <= 0.9 ? 17 : 14;
        reasons.push("Masuk anggaran");
      } else {
        score += tutor.hourlyRate <= 45000 ? 18 : 14;
      }

      if (scheduleQuery) {
        score += 15;
        reasons.push("Jadwal cocok");
      } else {
        score += tutor.slots.length >= 3 ? 13 : 10;
      }

      results.push({
        tutor,
        courses: tutorCourses,
        matchScore: Math.min(100, Math.max(1, score)),
        matchReasons: reasons,
      });
    }

    if (hasActiveFilter) {
      results.sort((a, b) => {
        const scoreDiff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        return scoreDiff !== 0 ? scoreDiff : a.tutor.hourlyRate - b.tutor.hourlyRate;
      });
    } else {
      results.sort((a, b) => a.tutor.name.localeCompare(b.tutor.name, "id"));
    }

    return results;
  },

  // shortcut: demo trusts caller-supplied userId; derive identity from ctx.auth in Convex
  submitApplication(input: {
    userId: string;
    name: string;
    courseIds: string[];
    topics: string[];
    bio: string;
    hourlyRateRaw: string | number;
    slots: string[];
  }): ServiceResult<TutorApplication> {
    const validation = validateTutorApplicationInput(input);
    if (!validation.valid || !validation.hourlyRate) {
      const firstError =
        Object.values(validation.errors)[0] ??
        "Periksa kembali kelengkapan formulir pendaftaran tutor.";
      return { ok: false, error: firstError };
    }
    const rate = validation.hourlyRate;

    let result: ServiceResult<TutorApplication> = {
      ok: false,
      error: "Silakan login demo terlebih dahulu sebelum mendaftar jadi tutor.",
    };

    let createdApplication: TutorApplication | null = null;

    updateDemoState((prev) => {
      const user = prev.users.find((u) => u.id === input.userId);
      if (!user) return prev;

      const application: TutorApplication = {
        id: createSyntheticId("app-tutor"),
        userId: user.id,
        name: input.name.trim(),
        courseIds: [...input.courseIds],
        topics: input.topics.map((t) => t.trim()).filter(Boolean),
        bio: input.bio.trim(),
        hourlyRate: rate,
        slots: input.slots.map((s) => s.trim()).filter(Boolean),
        status: "pending",
        createdAt: Date.now(),
      };
      createdApplication = application;
      result = { ok: true, data: application };
      return {
        ...prev,
        tutorApplications: [application, ...prev.tutorApplications],
      };
    });

    if (createdApplication) {
      const app: TutorApplication = createdApplication;
      getConvexMutationHandlers()?.submitApplication({
        appId: app.id,
        userId: app.userId,
        name: app.name,
        courseIds: app.courseIds,
        topics: app.topics,
        bio: app.bio,
        hourlyRate: app.hourlyRate,
        slots: app.slots,
      });
    }

    return result;
  },

  listApplications(userId: string): TutorApplication[] {
    return getDemoStateSnapshot()
      .tutorApplications.filter((app) => app.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
};
