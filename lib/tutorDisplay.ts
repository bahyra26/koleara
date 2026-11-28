import type { Course, Tutor, TutorLocation } from "@/lib/contracts";

const COURSE_SHORT_LABELS: Record<string, string> = {
  "course-kalkulus-1": "Calculus 1",
  "course-fisika-dasar-1": "Physics 1",
};

const COURSE_FULL_LABELS: Record<string, string> = {
  "course-kalkulus-1": "Calculus 1",
  "course-fisika-dasar-1": "Basic Physics 1",
};

const COURSE_TAB_LABELS: Record<string, string> = {
  "course-kalkulus-1": "Calculus",
  "course-fisika-dasar-1": "Basic Physics",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  Matematika: "Department of Mathematics",
  Fisika: "Department of Physics",
  "Teknik Informatika": "Department of Informatics",
  "Teknik Mesin": "Department of Mechanical Engineering",
  Statistika: "Department of Statistics",
};

const TOPIC_LABELS: Record<string, string> = {
  "Limit & Kekontinuan": "Limits & Continuity",
  Turunan: "Derivatives",
  "Aplikasi Turunan": "Applications of Derivatives",
  "Integral Tak Tentu": "Indefinite Integrals",
  "Integral Tentu": "Definite Integrals",
  "Teknik Integrasi": "Integration Techniques",
  Kinematika: "Kinematics",
  "Hukum Newton": "Newton's Laws",
  "Usaha & Energi": "Work & Energy",
  "Momentum & Tumbukan": "Momentum & Collisions",
  "Dinamika Rotasi": "Rotational Dynamics",
  "Osilasi & Gelombang": "Oscillations & Waves",
};

export function formatCoursePillLabel(course?: Pick<Course, "id" | "name">): string {
  if (!course) return "Course";
  return COURSE_SHORT_LABELS[course.id] ?? course.name;
}

export function formatCourseOptionLabel(course: Pick<Course, "id" | "name">): string {
  return COURSE_FULL_LABELS[course.id] ?? course.name;
}

export function formatCourseTabLabel(course: Pick<Course, "id" | "name">): string {
  return COURSE_TAB_LABELS[course.id] ?? course.name;
}

export function formatDepartmentLabel(department: string): string {
  const mapped = DEPARTMENT_LABELS[department.trim()];
  if (mapped) return mapped;
  if (/^department\s+of\b/i.test(department.trim())) return department.trim();
  return `Department of ${department.trim()}`;
}

export function formatTopicLabel(topic: string): string {
  return TOPIC_LABELS[topic.trim()] ?? topic;
}

export function formatIdrSpaced(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function isPhysicsCourse(courseId?: string): boolean {
  return courseId === "course-fisika-dasar-1";
}

export function resolvePrimaryCourse(
  tutor: Pick<Tutor, "courseIds">,
  courses: Course[],
  preferredCourseId?: string
): Course | undefined {
  if (preferredCourseId && tutor.courseIds.includes(preferredCourseId)) {
    const matched = courses.find((c) => c.id === preferredCourseId);
    if (matched) return matched;
  }
  return courses[0];
}

export function formatLocationLabel(location: TutorLocation): string {
  if (location === "online") return "Online";
  if (location === "offline") return "Offline (ITS Sukolilo)";
  return "Online & Offline";
}
