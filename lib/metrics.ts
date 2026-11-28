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
  acceptanceRatePercent: number;
  paymentCompletionRatePercent: number;
  averageTutorRating: number;
  totalRevenueIdr: number;
};

export function computePilotMetrics(input: {
  users: ReadonlyArray<{ role: string }>;
  verifiedTutors: ReadonlyArray<{ rating?: number }>;
  pendingApplicationsCount: number;
  conversationsCount: number;
  messagesCount: number;
  bookings: ReadonlyArray<{ status: string; price: number }>;
}): PilotMetricsSummary {
  const totalBookings = input.bookings.length;
  let acceptedOrPaidBookings = 0;
  let paidBookings = 0;
  let totalRevenueIdr = 0;

  for (const b of input.bookings) {
    if (b.status === "accepted" || b.status === "paid") {
      acceptedOrPaidBookings += 1;
    }
    if (b.status === "paid") {
      paidBookings += 1;
      totalRevenueIdr += b.price;
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
    acceptanceRatePercent,
    paymentCompletionRatePercent,
    averageTutorRating,
    totalRevenueIdr,
  };
}
