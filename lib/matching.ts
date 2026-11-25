/**
 * KOLEARA Explainable Rule-Based Matching Engine (Bab 4.7 Technical Design Brief)
 *
 * Rumus skor kecocokan (0 - 100):
 * S = 0.35 * M_topik + 0.30 * M_kepercayaan + 0.20 * M_anggaran + 0.15 * M_jadwal
 *
 * - M_topik = 100 jika tutor menguasai subtopik t; 60 jika hanya matkul c secara umum.
 * - M_kepercayaan = 0.5 * V + 0.5 * Q
 *   V = 100 (Verified Asdos) atau 80 (Verified Grade)
 *   Rating Bayesian = (3.5 * 3 + sumRatings) / (3 + reviewCount)
 *   Q = (Rating Bayesian / 5) * 100
 * - M_anggaran = min(100, 50 + 100 * (B - R) / B)
 * - M_jadwal = min(matchingSlotsCount, 3) / 3 * 100
 * - Tie-break: bayesianRating lebih tinggi -> hourlyRate lebih rendah -> tutorId ascending
 */

export type MatchingCandidateInput = {
  tutorId: string;
  mastersSubtopic: boolean;
  subtopicLabel?: string;
  courseLabel?: string;
  badge?: "asdos" | "grade";
  rating?: number;
  reviewCount?: number;
  ratingSum?: number;
  hourlyRate: number;
  maxBudget?: number | null;
  matchingSlotsCount: number;
};

export type MatchingCalculationResult = {
  totalScore: number;
  roundedScore: number;
  topicScore: number;
  trustScore: number;
  budgetScore: number;
  scheduleScore: number;
  bayesianRating: number;
  reasons: string[];
};

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeBayesianRating(params: {
  rating?: number;
  reviewCount?: number;
  ratingSum?: number;
}): number {
  const n =
    typeof params.reviewCount === "number" && params.reviewCount >= 0
      ? params.reviewCount
      : typeof params.rating === "number"
        ? 10
        : 0;

  const sum =
    typeof params.ratingSum === "number"
      ? params.ratingSum
      : typeof params.rating === "number"
        ? params.rating * n
        : 0;

  return (3.5 * 3 + sum) / (3 + n);
}

export function calculateBriefMatchScore(
  input: MatchingCandidateInput
): MatchingCalculationResult {
  // 1. M_topik (35%)
  const topicScore = input.mastersSubtopic ? 100 : 60;

  // 2. M_kepercayaan (30%) = 0.5 * V + 0.5 * Q
  const vScore = input.badge === "asdos" ? 100 : 80;
  const bayesianRating = computeBayesianRating({
    rating: input.rating,
    reviewCount: input.reviewCount,
    ratingSum: input.ratingSum,
  });
  const qScore = (bayesianRating / 5) * 100;
  const trustScore = 0.5 * vScore + 0.5 * qScore;

  // 3. M_anggaran (20%) = min(100, 50 + 100 * (B - R) / B)
  // Default reference budget Rp50.000 if user leaves maxBudget empty
  const effectiveBudget =
    typeof input.maxBudget === "number" && input.maxBudget > 0
      ? input.maxBudget
      : Math.max(50000, input.hourlyRate);
  const rawBudgetScore =
    50 + (100 * (effectiveBudget - input.hourlyRate)) / effectiveBudget;
  const budgetScore = Math.max(0, Math.min(100, rawBudgetScore));

  // 4. M_jadwal (15%) = min(matchingSlotsCount, 3) / 3 * 100
  const cappedSlots = Math.min(Math.max(input.matchingSlotsCount, 0), 3);
  const scheduleScore = (cappedSlots / 3) * 100;

  const totalScore =
    0.35 * topicScore +
    0.3 * trustScore +
    0.2 * budgetScore +
    0.15 * scheduleScore;

  const reasons: string[] = [];
  if (input.mastersSubtopic) {
    reasons.push(
      input.subtopicLabel
        ? `Menguasai ${input.subtopicLabel}`
        : "Topik cocok"
    );
  } else if (input.courseLabel) {
    reasons.push(`${input.courseLabel} umum`);
  }

  if (input.badge === "asdos") {
    reasons.push("Verified Asdos");
  } else {
    reasons.push("Verified Grade");
  }

  if (typeof input.maxBudget === "number" && input.maxBudget > 0) {
    reasons.push("Masuk anggaran");
  } else {
    reasons.push(`Rp${Math.round(input.hourlyRate / 1000)}k`);
  }

  if ((input.reviewCount ?? (input.rating ? 1 : 0)) === 0) {
    reasons.push("Tutor baru");
  } else if (input.matchingSlotsCount > 0) {
    reasons.push(
      input.matchingSlotsCount === 1
        ? "Jadwal cocok"
        : `${Math.min(input.matchingSlotsCount, 3)} slot cocok`
    );
  }

  return {
    totalScore: round1(totalScore),
    roundedScore: Math.min(100, Math.max(1, Math.round(totalScore))),
    topicScore: round1(topicScore),
    trustScore: round1(trustScore),
    budgetScore: round1(budgetScore),
    scheduleScore: round1(scheduleScore),
    bayesianRating: round1(bayesianRating),
    reasons,
  };
}

export type RankableCourse = {
  id: string;
  name: string;
  code: string;
  description: string;
  topics: string[];
};

export type RankableTutor = {
  id: string;
  userId: string;
  name: string;
  department: string;
  cohort: number;
  bio: string;
  courseIds: string[];
  topics: string[];
  hourlyRate: number;
  verified: boolean;
  badge?: "grade" | "asdos";
  rating?: number;
  completedSessionsDemo?: number;
  slots: string[];
};

export type RankedTutorItem<
  TTutor extends RankableTutor = RankableTutor,
  TCourse extends RankableCourse = RankableCourse,
> = {
  tutor: TTutor;
  courses: TCourse[];
  matchScore?: number;
  matchReasons: string[];
};

export function rankVerifiedTutors<
  TTutor extends RankableTutor,
  TCourse extends RankableCourse,
>(
  tutors: readonly TTutor[],
  courses: readonly TCourse[],
  filters: {
    query?: string;
    courseId?: string;
    topic?: string;
    maxBudget?: number | null;
    scheduleQuery?: string;
  }
): Array<RankedTutorItem<TTutor, TCourse>> {
  if (
    typeof filters.maxBudget === "number" &&
    (!Number.isFinite(filters.maxBudget) || filters.maxBudget < 0)
  ) {
    return [];
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const queryText = (filters.query ?? "").trim().toLowerCase();
  const courseId = (filters.courseId ?? "").trim();
  const topic = (filters.topic ?? "").trim().toLowerCase();
  const maxBudget =
    typeof filters.maxBudget === "number" ? filters.maxBudget : null;
  const scheduleQuery = (filters.scheduleQuery ?? "").trim().toLowerCase();

  const hasActiveFilter = Boolean(
    queryText || courseId || topic || maxBudget !== null || scheduleQuery
  );

  const scored: Array<{
    item: RankedTutorItem<TTutor, TCourse>;
    rawTotal: number;
    bayesianRating: number;
  }> = [];

  for (const tutor of tutors) {
    if (!tutor.verified) continue;

    const tutorCourses = tutor.courseIds
      .map((id) => courseById.get(id))
      .filter((c): c is TCourse => Boolean(c));

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

    if (queryText) {
      const haystack = [
        tutor.name,
        tutor.department,
        tutor.bio,
        ...tutorCourses.map((c) => c.name),
        ...tutor.topics,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(queryText)) continue;
    }

    if (!hasActiveFilter) {
      scored.push({
        item: { tutor, courses: tutorCourses, matchReasons: [] },
        rawTotal: 0,
        bayesianRating: 0,
      });
      continue;
    }

    const matchedTopicLabel = topic
      ? tutor.topics.find((t) => t.toLowerCase().includes(topic))
      : queryText
        ? tutor.topics.find((t) => t.toLowerCase().includes(queryText))
        : undefined;

    const matchingSlotsCount = scheduleQuery
      ? tutor.slots.filter((slot) =>
          slot.toLowerCase().includes(scheduleQuery)
        ).length
      : tutor.slots.length;

    const preferredCourseLabel = courseId
      ? courseById.get(courseId)?.name
      : tutorCourses[0]?.name;

    const calc = calculateBriefMatchScore({
      tutorId: tutor.id,
      mastersSubtopic: Boolean(matchedTopicLabel),
      subtopicLabel: matchedTopicLabel,
      courseLabel: preferredCourseLabel ?? tutorCourses[0]?.name,
      badge: tutor.badge,
      rating: tutor.rating,
      hourlyRate: tutor.hourlyRate,
      maxBudget,
      matchingSlotsCount,
    });

    scored.push({
      item: {
        tutor,
        courses: tutorCourses,
        matchScore: calc.roundedScore,
        matchReasons: calc.reasons,
      },
      rawTotal: calc.totalScore,
      bayesianRating: calc.bayesianRating,
    });
  }

  if (hasActiveFilter) {
    scored.sort((a, b) => {
      if (b.rawTotal !== a.rawTotal) return b.rawTotal - a.rawTotal;
      if (b.bayesianRating !== a.bayesianRating) {
        return b.bayesianRating - a.bayesianRating;
      }
      if (a.item.tutor.hourlyRate !== b.item.tutor.hourlyRate) {
        return a.item.tutor.hourlyRate - b.item.tutor.hourlyRate;
      }
      return a.item.tutor.id.localeCompare(b.item.tutor.id);
    });
  } else {
    scored.sort((a, b) =>
      a.item.tutor.name.localeCompare(b.item.tutor.name, "id")
    );
  }

  return scored.map((entry) => entry.item);
}
