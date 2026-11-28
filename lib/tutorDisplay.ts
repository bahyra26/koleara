import type { Course, Tutor } from "./contracts";

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

export function formatVerificationBadge(badge?: "grade" | "asdos"): string {
  if (badge === "asdos") return "Verified \u00b7 Teaching Assistant";
  return "Verified \u00b7 Grade A";
}

export type BioSegment = {
  text: string;
  highlight?: boolean;
};

const TUTOR_ENGLISH_BIOS: Record<string, BioSegment[]> = {
  "tutor-nadia": [
    { text: "I like turning scary limits and integral problems into small steps. Expect lots of " },
    { text: "practice questions", highlight: true },
    { text: " and a " },
    { text: "short recap", highlight: true },
    { text: " after each session." },
  ],
  "tutor-raka": [
    { text: "Basic Physics lab assistant focused on clear free-body diagrams. Every session includes " },
    { text: "guided problem sets", highlight: true },
    { text: " and " },
    { text: "exam intuition", highlight: true },
    { text: " for mechanics." },
  ],
  "tutor-salsa": [
    { text: "Earned Grade A in both Calculus 1 and Basic Physics 1. Great for " },
    { text: "weekly quiz prep", highlight: true },
    { text: " with " },
    { text: "student-friendly pacing", highlight: true },
    { text: " and clear notes." },
  ],
  "tutor-dimas": [
    { text: "Mechanical engineering senior connecting Calculus tools to real physics problems with " },
    { text: "visual breakdowns", highlight: true },
    { text: " and " },
    { text: "past-exam drills", highlight: true },
    { text: "." },
  ],
  "tutor-alya": [
    { text: "Statistics student who enjoys breaking down derivatives and integrals slowly using " },
    { text: "structured steps", highlight: true },
    { text: " and a " },
    { text: "summary sheet", highlight: true },
    { text: " you can review anytime." },
  ],
};

export function getTutorBioSegments(tutor: Pick<Tutor, "id" | "bio">): BioSegment[] {
  return TUTOR_ENGLISH_BIOS[tutor.id] ?? [{ text: tutor.bio }];
}

export type TimeSlotCell = {
  id: string;
  day: string;
  time: string;
  displayTime: string;
  available: boolean;
};

export type TutorDayColumn = {
  day: string;
  cells: TimeSlotCell[];
};

const DAY_TO_SHORT: Record<string, string> = {
  senin: "Mon",
  monday: "Mon",
  mon: "Mon",
  selasa: "Tue",
  tuesday: "Tue",
  tue: "Tue",
  rabu: "Wed",
  wednesday: "Wed",
  wed: "Wed",
  kamis: "Thu",
  thursday: "Thu",
  thu: "Thu",
  jumat: "Fri",
  friday: "Fri",
  fri: "Fri",
  sabtu: "Sat",
  saturday: "Sat",
  sat: "Sat",
  minggu: "Sun",
  sunday: "Sun",
  sun: "Sun",
};

const FALLBACK_DAYS = ["Mon", "Wed", "Sat", "Fri", "Tue", "Thu", "Sun"];
const FALLBACK_TIMES = ["16:00", "17:00", "19:00"];

function normalizeSlotTime(raw: string): string {
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "19:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function buildTutorScheduleMatrix(
  tutor: Pick<Tutor, "id" | "slots">
): TutorDayColumn[] {
  const parsedAvailable = new Set<string>();
  const orderedDays: string[] = [];
  const uniqueTimes = new Set<string>();

  for (const raw of tutor.slots) {
    const parts = raw.trim().split(/\s+/);
    const dayKey = (parts[0] ?? "").toLowerCase();
    const shortDay = DAY_TO_SHORT[dayKey];
    if (!shortDay) continue;
    if (!orderedDays.includes(shortDay)) {
      orderedDays.push(shortDay);
    }
    const exactTime = normalizeSlotTime(raw);
    uniqueTimes.add(exactTime);
    parsedAvailable.add(`${shortDay}-${exactTime}`);
  }

  for (const d of FALLBACK_DAYS) {
    if (orderedDays.length >= 4) break;
    if (!orderedDays.includes(d)) {
      orderedDays.push(d);
    }
  }

  for (const fallbackTime of FALLBACK_TIMES) {
    if (uniqueTimes.size >= 3) break;
    uniqueTimes.add(fallbackTime);
  }

  const columns = orderedDays.slice(0, 4);
  const gridTimes = Array.from(uniqueTimes).sort().slice(0, 3);
  const lastRowTime = gridTimes[gridTimes.length - 1] ?? "19:00";

  if (columns[3]) {
    parsedAvailable.add(`${columns[3]}-${lastRowTime}`);
  }

  return columns.map((day) => ({
    day,
    cells: gridTimes.map((time) => {
      const id = `${day} ${time}`;
      const [hh, mm] = time.split(":");
      return {
        id,
        day,
        time,
        displayTime: `${hh} : ${mm}`,
        available: parsedAvailable.has(`${day}-${time}`),
      };
    }),
  }));
}

