export type Role = "learner" | "tutor" | "admin";

export type LanguageCode = "id" | "en";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  nrp?: string;
  cohortYear?: number;
  department?: string;
  preferredLanguage?: LanguageCode;
  whatsapp?: string;
  isAdmin?: boolean;
  avatarUrl?: string;
  onboardedAt?: number;
  createdAt?: number;
};

export type Course = {
  id: string;
  name: string;
  code: string;
  description: string;
  aliases?: string[];
  topics: string[];
};

export type VerificationBadge = "grade" | "asdos";

export type TutorLocation = "online" | "offline" | "hybrid";

export type TutorLocationFilter = "online" | "offline";

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
  reviewCount?: number;
  clarityRatingAvg?: number;
  pacingRatingAvg?: number;
  completedSessions?: number;
  completedSessionsDemo?: number;
  cancelledByTutorCount?: number;
  location?: TutorLocation;
  campusSpots?: string[];
  languages?: LanguageCode[];
  avatarUrl?: string;
  slots: string[];
};

export type TutorApplicationStatus = "pending" | "approved" | "rejected";

export type TutorApplication = {
  id: string;
  userId: string;
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
  proofFileName?: string;
  proofUrl?: string;
  payoutBankOrWallet?: string;
  payoutAccountName?: string;
  payoutAccountNumber?: string;
  status: TutorApplicationStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
  createdAt: number;
};

export type TutorPayoutAccount = {
  tutorId: string;
  userId: string;
  bankOrWallet: string;
  accountName: string;
  accountNumber: string;
  updatedAt: number;
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

export type DifficultyTier = "basic" | "intermediate" | "exam_prep";

export type BookingStatus =
  | "offered"
  | "requested"
  | "accepted"
  | "declined"
  | "paid"
  | "tutor_marked_done"
  | "completed"
  | "cancelled"
  | "expired"
  | "disputed";

export type EscrowStatus =
  | "none"
  | "held"
  | "ready_for_payout"
  | "paid_out"
  | "refunded";

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
  sessionCount?: 1 | 4;
  price: number;
  meetingMode?: MeetingMode;
  brief?: string;
  difficultyTier?: DifficultyTier;
  diagnosticNotes?: string;
  agreedNoJoki?: boolean;
  meetingLink?: string;
  status: BookingStatus;
  escrowStatus?: EscrowStatus;
  declineReason?: string;
  paymentDeadlineAt?: number;
  acceptedAt?: number;
  paidAt?: number;
  tutorMarkedDoneAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancelledBy?: string;
  createdAt: number;
};

export type PaymentStatus =
  | "unpaid"
  | "pending_verification"
  | "rejected"
  | "paid"
  | "refunded";

export type PaymentMode = "static_qris" | "midtrans";

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod?: string;
  proofName?: string;
  proofUrl?: string;
  midtransOrderId?: string;
  midtransTransactionId?: string;
  midtransSnapToken?: string;
  midtransRedirectUrl?: string;
  submittedAt?: number;
  verifiedAt?: number;
  paidAt?: number;
  refundedAt?: number;
  rejectionReason?: string;
};

export type SessionReview = {
  id: string;
  bookingId: string;
  learnerId: string;
  tutorId: string;
  clarityRating: number;
  pacingRating: number;
  reviewText?: string;
  createdAt: number;
};

export type PayoutStatus = "pending" | "paid_out";

export type Payout = {
  id: string;
  tutorId: string;
  amount: number;
  bookingIds: string[];
  status: PayoutStatus;
  proofFileName?: string;
  proofUrl?: string;
  paidOutAt?: number;
  processedBy?: string;
  createdAt: number;
};

export type PaymentConfig = {
  mode: PaymentMode;
  merchantName: string;
  qrisImageUrl?: string;
  instructions: string;
  accountInfo?: string;
  midtransEnabled: boolean;
  updatedAt: number;
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
  location?: TutorLocationFilter | "";
  language?: LanguageCode | "";
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
  paymentConfig?: PaymentConfig;
};
