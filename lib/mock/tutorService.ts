import type {
  Course,
  ServiceResult,
  Tutor,
  TutorApplication,
  TutorSearchFilters,
  TutorSearchResult,
  VerificationBadge,
} from "@/lib/contracts";
import { rankVerifiedTutors } from "@/lib/matching";
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
    return rankVerifiedTutors(state.tutors, state.courses, filters);
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
    const uniqueCourseIds = Array.from(
      new Set(input.courseIds.map((id) => id.trim()).filter(Boolean))
    );
    const cleanTopics = Array.from(
      new Set(input.topics.map((t) => t.trim()).filter(Boolean))
    ).slice(0, 20);
    const cleanSlots = Array.from(
      new Set(input.slots.map((s) => s.trim()).filter(Boolean))
    ).slice(0, 20);

    const validation = validateTutorApplicationInput({
      ...input,
      courseIds: uniqueCourseIds,
      topics: cleanTopics,
      slots: cleanSlots,
    });
    if (!validation.valid || !validation.hourlyRate) {
      const firstError =
        Object.values(validation.errors)[0] ??
        "Periksa kembali kelengkapan formulir pendaftaran tutor.";
      return { ok: false, code: "INVALID_INPUT", error: firstError };
    }
    const rate = validation.hourlyRate;

    let result: ServiceResult<TutorApplication> = {
      ok: false,
      code: "USER_NOT_FOUND",
      error: "Silakan login demo terlebih dahulu sebelum mendaftar jadi tutor.",
    };

    let createdApplication: TutorApplication | null = null;

    updateDemoState((prev) => {
      const user = prev.users.find((u) => u.id === input.userId);
      if (!user) return prev;

      const validCourseIds = new Set(prev.courses.map((c) => c.id));
      if (uniqueCourseIds.some((cid) => !validCourseIds.has(cid))) {
        result = {
          ok: false,
          code: "COURSE_NOT_FOUND",
          error: "Terdapat mata kuliah yang tidak terdaftar di katalog.",
        };
        return prev;
      }

      const application: TutorApplication = {
        id: createSyntheticId("app-tutor"),
        userId: user.id,
        name: input.name.trim(),
        courseIds: uniqueCourseIds,
        topics: cleanTopics,
        bio: input.bio.trim(),
        hourlyRate: rate,
        slots: cleanSlots,
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
    if (!userId.trim()) return [];
    return getDemoStateSnapshot()
      .tutorApplications.filter((app) => app.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  approveApplication(params: {
    applicationId: string;
    department?: string;
    cohort?: number;
    badge?: VerificationBadge;
  }): ServiceResult<Tutor> {
    if (
      params.cohort !== undefined &&
      (!Number.isInteger(params.cohort) ||
        params.cohort < 2000 ||
        params.cohort > 2035)
    ) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Angkatan (cohort) harus berupa tahun bulat antara 2000–2035.",
      };
    }

    const department = (params.department ?? "Teknik Informatika").trim();
    if (department.length < 2 || department.length > 80) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Nama departemen wajib 2–80 karakter.",
      };
    }

    let result: ServiceResult<Tutor> = {
      ok: false,
      code: "NOT_FOUND",
      error: "Pengajuan tutor tidak ditemukan.",
    };

    updateDemoState((prev) => {
      const app = prev.tutorApplications.find(
        (a) => a.id === params.applicationId
      );
      if (!app) return prev;

      const existingTutor = prev.tutors.find((t) => t.userId === app.userId);
      const slug =
        app.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "kandidat";

      const tutor: Tutor = {
        id:
          existingTutor?.id ??
          `tutor-${slug}-${Date.now().toString(36).slice(-4)}`,
        userId: app.userId,
        name: app.name,
        department,
        cohort: params.cohort ?? 2023,
        bio: app.bio,
        courseIds: app.courseIds,
        topics: app.topics,
        hourlyRate: app.hourlyRate,
        verified: true,
        badge: params.badge ?? "grade",
        rating: existingTutor?.rating,
        completedSessionsDemo: existingTutor?.completedSessionsDemo ?? 0,
        slots: app.slots,
      };

      result = { ok: true, data: tutor };
      return {
        ...prev,
        users: prev.users.map((u) =>
          u.id === app.userId ? { ...u, role: "tutor" } : u
        ),
        tutors: existingTutor
          ? prev.tutors.map((t) => (t.id === existingTutor.id ? tutor : t))
          : [...prev.tutors, tutor],
        tutorApplications: prev.tutorApplications.filter(
          (a) => a.id !== app.id
        ),
      };
    });

    return result;
  },

  rejectApplication(applicationId: string): { rejected: boolean } {
    let rejected = false;
    updateDemoState((prev) => {
      const exists = prev.tutorApplications.some((a) => a.id === applicationId);
      if (!exists) return prev;
      rejected = true;
      return {
        ...prev,
        tutorApplications: prev.tutorApplications.filter(
          (a) => a.id !== applicationId
        ),
      };
    });
    return { rejected };
  },
};
