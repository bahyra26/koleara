export type PilotMetricsSummary = {
  totalUsers: number;
  totalLearners: number;
  totalVerifiedTutors: number;
  pendingTutorApplications: number;
  totalConversations: number;
  totalMessages: number;
  totalBookings: number;
  acceptedOrPaidBookings: number;
  paidBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  expiredBookings: number;
  acceptanceRatePercent: number;
  paymentCompletionRatePercent: number;
  sessionCompletionRatePercent: number;
  medianTimeToAcceptMinutes: number | null;
  medianTimeToFirstRequestMinutes: number | null;
  averageTutorRating: number;
  averageClarityRating: number;
  averagePacingRating: number;
  totalReviews: number;
  totalRevenueIdr: number;
  totalEscrowHeldIdr: number;
  totalPaidOutIdr: number;
};

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(raw * 10) / 10;
}

export function computePilotMetrics(input: {
  users: ReadonlyArray<{
    id?: string;
    appId?: string;
    role: string;
    createdAt?: number;
  }>;
  verifiedTutors: ReadonlyArray<{ rating?: number }>;
  pendingApplicationsCount: number;
  conversationsCount: number;
  messagesCount: number;
  bookings: ReadonlyArray<{
    status: string;
    price: number;
    learnerId?: string;
    createdAt?: number;
    acceptedAt?: number;
    escrowStatus?: string;
  }>;
  reviews?: ReadonlyArray<{
    clarityRating: number;
    pacingRating: number;
  }>;
}): PilotMetricsSummary {
  const totalBookings = input.bookings.length;
  let acceptedOrPaidBookings = 0;
  let paidBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;
  let expiredBookings = 0;
  let totalRevenueIdr = 0;
  let totalEscrowHeldIdr = 0;
  let totalPaidOutIdr = 0;

  const acceptDelaysMinutes: number[] = [];
  const firstBookingByLearner = new Map<string, number>();

  for (const b of input.bookings) {
    if (
      b.status === "accepted" ||
      b.status === "paid" ||
      b.status === "tutor_marked_done" ||
      b.status === "completed"
    ) {
      acceptedOrPaidBookings += 1;
    }
    if (
      b.status === "paid" ||
      b.status === "tutor_marked_done" ||
      b.status === "completed"
    ) {
      paidBookings += 1;
      totalRevenueIdr += b.price;
    }
    if (b.status === "completed") {
      completedBookings += 1;
    }
    if (b.status === "cancelled") {
      cancelledBookings += 1;
    }
    if (b.status === "expired") {
      expiredBookings += 1;
    }

    if (b.escrowStatus === "held" || b.escrowStatus === "ready_for_payout") {
      totalEscrowHeldIdr += b.price;
    } else if (b.escrowStatus === "paid_out") {
      totalPaidOutIdr += b.price;
    }

    if (
      typeof b.acceptedAt === "number" &&
      typeof b.createdAt === "number" &&
      b.acceptedAt >= b.createdAt
    ) {
      acceptDelaysMinutes.push((b.acceptedAt - b.createdAt) / 60_000);
    }

    if (b.learnerId && typeof b.createdAt === "number") {
      const prev = firstBookingByLearner.get(b.learnerId);
      if (prev === undefined || b.createdAt < prev) {
        firstBookingByLearner.set(b.learnerId, b.createdAt);
      }
    }
  }

  const firstRequestDelaysMinutes: number[] = [];
  for (const user of input.users) {
    const uid = user.id ?? user.appId;
    if (!uid || typeof user.createdAt !== "number") continue;
    const firstReq = firstBookingByLearner.get(uid);
    if (firstReq !== undefined && firstReq >= user.createdAt) {
      firstRequestDelaysMinutes.push((firstReq - user.createdAt) / 60_000);
    }
  }

  const acceptanceRatePercent =
    totalBookings > 0
      ? Math.round((acceptedOrPaidBookings / totalBookings) * 1000) / 10
      : 0;
  const paymentCompletionRatePercent =
    acceptedOrPaidBookings > 0
      ? Math.round((paidBookings / acceptedOrPaidBookings) * 1000) / 10
      : 0;
  const sessionCompletionRatePercent =
    paidBookings > 0
      ? Math.round((completedBookings / paidBookings) * 1000) / 10
      : 0;

  const ratedTutors = input.verifiedTutors.filter(
    (t) => typeof t.rating === "number"
  );
  const averageTutorRating =
    ratedTutors.length > 0
      ? Math.round(
          (ratedTutors.reduce((acc, t) => acc + (t.rating ?? 0), 0) /
            ratedTutors.length) *
            100
        ) / 100
      : 0;

  const reviews = input.reviews ?? [];
  const totalReviews = reviews.length;
  const averageClarityRating =
    totalReviews > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.clarityRating, 0) /
            totalReviews) *
            100
        ) / 100
      : 0;
  const averagePacingRating =
    totalReviews > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.pacingRating, 0) / totalReviews) *
            100
        ) / 100
      : 0;

  return {
    totalUsers: input.users.length,
    totalLearners: input.users.filter((u) => u.role === "learner").length,
    totalVerifiedTutors: input.verifiedTutors.length,
    pendingTutorApplications: input.pendingApplicationsCount,
    totalConversations: input.conversationsCount,
    totalMessages: input.messagesCount,
    totalBookings,
    acceptedOrPaidBookings,
    paidBookings,
    completedBookings,
    cancelledBookings,
    expiredBookings,
    acceptanceRatePercent,
    paymentCompletionRatePercent,
    sessionCompletionRatePercent,
    medianTimeToAcceptMinutes: computeMedian(acceptDelaysMinutes),
    medianTimeToFirstRequestMinutes: computeMedian(firstRequestDelaysMinutes),
    averageTutorRating,
    averageClarityRating,
    averagePacingRating,
    totalReviews,
    totalRevenueIdr,
    totalEscrowHeldIdr,
    totalPaidOutIdr,
  };
}
