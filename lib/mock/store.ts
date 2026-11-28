import type { DemoState } from "@/lib/contracts";
import { createSeedState } from "@/lib/mock/seed";

export const DEMO_STORAGE_KEY = "koleara-demo-v1";

const SERVER_SNAPSHOT: DemoState = createSeedState();

let currentState: DemoState = SERVER_SNAPSHOT;
let initializedClient = false;
let clientHydrated = false;

const listeners = new Set<() => void>();

export type RemoteCollections = Pick<
  DemoState,
  | "users"
  | "courses"
  | "tutors"
  | "tutorApplications"
  | "conversations"
  | "messages"
  | "bookings"
  | "payments"
>;

export type ConvexMutationHandlers = {
  verifyDemoOtp: (args: {
    email: string;
    otp: string;
    mode: "login" | "signup";
    name?: string;
  }) => void;
  resetDemoData: () => void;
  submitApplication: (args: {
    appId: string;
    userId: string;
    name: string;
    courseIds: string[];
    topics: string[];
    bio: string;
    hourlyRate: number;
    slots: string[];
  }) => void;
  getOrCreateConversation: (args: {
    appId?: string;
    learnerId: string;
    tutorId: string;
  }) => void;
  sendMessage: (args: {
    appId: string;
    conversationId: string;
    senderId: string;
    content: string;
  }) => void;
  markRead: (args: { conversationId: string; readerId: string }) => void;
  createOffer: (args: {
    bookingAppId: string;
    messageAppId: string;
    conversationId: string;
    actorUserId: string;
    courseId: string;
    topic: string;
    startAt: number;
    price: number;
    meetingMode?: "online" | "offline_its";
    brief?: string;
  }) => void;
  acceptOffer: (args: { bookingId: string; actorUserId: string }) => void;
  declineOffer: (args: { bookingId: string; actorUserId: string }) => void;
  startPayment: (args: { bookingId: string; actorUserId: string }) => void;
  submitDemoProof: (args: {
    bookingId: string;
    actorUserId: string;
    proofName?: string;
  }) => void;
  simulateVerification: (args: {
    bookingId: string;
    decision: "approve" | "reject";
  }) => void;
};

let convexHandlers: ConvexMutationHandlers | null = null;

export function registerConvexMutationHandlers(
  handlers: ConvexMutationHandlers | null
): void {
  convexHandlers = handlers;
  notifyListeners();
}

export function getConvexMutationHandlers(): ConvexMutationHandlers | null {
  return convexHandlers;
}

export function applyRemoteCollections(remote: RemoteCollections): void {
  const activeUser =
    currentState.currentUserId &&
    !remote.users.some((u) => u.id === currentState.currentUserId)
      ? currentState.users.find((u) => u.id === currentState.currentUserId)
      : undefined;

  const mergedUsers = activeUser ? [...remote.users, activeUser] : remote.users;

  const next: DemoState = {
    ...currentState,
    users: mergedUsers,
    courses: remote.courses,
    tutors: remote.tutors,
    tutorApplications: remote.tutorApplications,
    conversations: remote.conversations,
    messages: remote.messages,
    bookings: remote.bookings,
    payments: remote.payments,
  };
  currentState = next;
  writePersistedState(next);
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isStr);
}

export function isValidDemoState(value: unknown): value is DemoState {
  if (!isObj(value) || value.version !== 1) return false;
  if (value.currentUserId !== null && !isStr(value.currentUserId)) return false;
  if (value.lastLearnerId !== null && !isStr(value.lastLearnerId)) return false;

  const {
    users,
    courses,
    tutors,
    tutorApplications,
    conversations,
    messages,
    bookings,
    payments,
  } = value;

  if (
    !Array.isArray(users) ||
    !Array.isArray(courses) ||
    !Array.isArray(tutors) ||
    !Array.isArray(tutorApplications) ||
    !Array.isArray(conversations) ||
    !Array.isArray(messages) ||
    !Array.isArray(bookings) ||
    !Array.isArray(payments)
  ) {
    return false;
  }

  return (
    users.every(
      (u) =>
        isObj(u) &&
        isStr(u.id) &&
        isStr(u.email) &&
        isStr(u.name) &&
        (u.role === "learner" || u.role === "tutor")
    ) &&
    courses.every(
      (c) =>
        isObj(c) &&
        isStr(c.id) &&
        isStr(c.name) &&
        isStr(c.code) &&
        isStr(c.description) &&
        isStrArr(c.topics)
    ) &&
    tutors.every(
      (t) =>
        isObj(t) &&
        isStr(t.id) &&
        isStr(t.userId) &&
        isStr(t.name) &&
        isStr(t.department) &&
        isNum(t.cohort) &&
        isStr(t.bio) &&
        isStrArr(t.courseIds) &&
        isStrArr(t.topics) &&
        isNum(t.hourlyRate) &&
        typeof t.verified === "boolean" &&
        isStrArr(t.slots)
    ) &&
    tutorApplications.every(
      (a) =>
        isObj(a) &&
        isStr(a.id) &&
        isStr(a.userId) &&
        isStr(a.name) &&
        isStrArr(a.courseIds) &&
        isStrArr(a.topics) &&
        isStr(a.bio) &&
        isNum(a.hourlyRate) &&
        isStrArr(a.slots) &&
        a.status === "pending" &&
        isNum(a.createdAt)
    ) &&
    conversations.every(
      (c) =>
        isObj(c) &&
        isStr(c.id) &&
        isStr(c.learnerId) &&
        isStr(c.tutorId) &&
        isNum(c.lastMessageAt)
    ) &&
    messages.every(
      (m) =>
        isObj(m) &&
        isStr(m.id) &&
        isStr(m.conversationId) &&
        isStr(m.senderId) &&
        (m.type === "text" || m.type === "offer") &&
        isNum(m.createdAt)
    ) &&
    bookings.every(
      (b) =>
        isObj(b) &&
        isStr(b.id) &&
        isStr(b.conversationId) &&
        isStr(b.learnerId) &&
        isStr(b.tutorId) &&
        isStr(b.courseId) &&
        isStr(b.topic) &&
        isNum(b.startAt) &&
        b.durationMinutes === 60 &&
        isNum(b.price) &&
        (b.status === "offered" ||
          b.status === "accepted" ||
          b.status === "declined" ||
          b.status === "paid") &&
        isNum(b.createdAt)
    ) &&
    payments.every(
      (p) =>
        isObj(p) &&
        isStr(p.id) &&
        isStr(p.bookingId) &&
        isNum(p.amount) &&
        (p.status === "unpaid" ||
          p.status === "pending_verification" ||
          p.status === "rejected" ||
          p.status === "paid")
    )
  );
}

function clearCorruptKey(): void {
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

function readPersistedState(): DemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDemoState(parsed)) {
      clearCorruptKey();
      return null;
    }
    return parsed;
  } catch {
    clearCorruptKey();
    return null;
  }
}

function writePersistedState(nextState: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Gracefully keep running in memory if localStorage is unavailable/full
  }
}

export function createSyntheticId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function getDemoStateSnapshot(): DemoState {
  return currentState;
}

export function getDemoServerSnapshot(): DemoState {
  return SERVER_SNAPSHOT;
}

export function getDemoHydratedSnapshot(): boolean {
  return clientHydrated;
}

export function getDemoHydratedServerSnapshot(): boolean {
  return false;
}

export function subscribeDemoStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hydrateDemoStore(): void {
  if (typeof window === "undefined") return;

  const persisted = readPersistedState();
  if (persisted) {
    currentState = persisted;
  }
  clientHydrated = true;
  notifyListeners();

  if (initializedClient) return;
  initializedClient = true;

  window.addEventListener("storage", (event) => {
    if (event.key !== DEMO_STORAGE_KEY) return;
    currentState = readPersistedState() ?? createSeedState();
    notifyListeners();
  });
}

// shortcut: single-browser localStorage RMW has no cross-process lock; replace with Convex mutations for real multi-user writes
export function updateDemoState(
  updater: (prev: DemoState) => DemoState
): DemoState {
  const base =
    clientHydrated && typeof window !== "undefined"
      ? (readPersistedState() ?? currentState)
      : currentState;
  const next = updater(base);
  if (next === base) {
    currentState = base;
    return currentState;
  }
  currentState = next;
  writePersistedState(next);
  notifyListeners();
  return next;
}

export function resetDemoStore(): DemoState {
  const fresh = createSeedState();
  currentState = fresh;
  if (typeof window !== "undefined") {
    clearCorruptKey();
  }
  notifyListeners();
  return fresh;
}
