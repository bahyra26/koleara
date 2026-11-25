export type Role = "learner" | "tutor";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type Course = {
  id: string;
  name: string;
  code: string;
  description: string;
  topics: string[];
};

export type VerificationBadge = "grade" | "asdos";

export type Tutor = {
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
  badge?: VerificationBadge;
  rating?: number;
  completedSessionsDemo?: number;
  slots: string[];
};

export type TutorApplicationStatus = "pending";

export type TutorApplication = {
  id: string;
  userId: string;
  name: string;
  courseIds: string[];
  topics: string[];
  bio: string;
  hourlyRate: number;
  slots: string[];
  status: TutorApplicationStatus;
  createdAt: number;
};

export type Conversation = {
  id: string;
  learnerId: string;
  tutorId: string;
  lastMessageAt: number;
};

export type MessageType = "text" | "offer";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string;
  bookingId?: string;
  createdAt: number;
  readAt?: number;
};

export type BookingStatus = "offered" | "accepted" | "declined" | "paid";

export type MeetingMode = "online" | "offline_its";

export type Booking = {
  id: string;
  conversationId: string;
  learnerId: string;
  tutorId: string;
  courseId: string;
  topic: string;
  startAt: number;
  durationMinutes: 60;
  price: number;
  meetingMode?: MeetingMode;
  brief?: string;
  status: BookingStatus;
  createdAt: number;
};

export type PaymentStatus =
  | "unpaid"
  | "pending_verification"
  | "rejected"
  | "paid";

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  proofName?: string;
  submittedAt?: number;
  verifiedAt?: number;
  rejectionReason?: string;
};

export type DemoState = {
  version: 1;
  currentUserId: string | null;
  lastLearnerId: string | null;
  users: User[];
  courses: Course[];
  tutors: Tutor[];
  tutorApplications: TutorApplication[];
  conversations: Conversation[];
  messages: Message[];
  bookings: Booking[];
  payments: Payment[];
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export type TutorSearchFilters = {
  query?: string;
  courseId?: string;
  topic?: string;
  maxBudget?: number | null;
  scheduleQuery?: string;
};

export type TutorSearchResult = {
  tutor: Tutor;
  courses: Course[];
  matchScore?: number;
  matchReasons: string[];
};

export type ConversationSummary = {
  conversation: Conversation;
  learner: User;
  tutor: Tutor;
  peerName: string;
  peerRoleLabel: string;
  lastMessage: Message | null;
  unreadCount: number;
};

export type CheckoutViewData = {
  booking: Booking;
  payment: Payment;
  tutor: Tutor;
  learner: User;
  course: Course;
};
