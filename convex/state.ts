import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  canRevealSensitiveContact,
  isDemoFallbackAllowed,
  mapTutorDoc,
  mapUserDoc,
} from "./lib/auth";
import {
  bookingObjectValidator,
  conversationObjectValidator,
  courseObjectValidator,
  messageObjectValidator,
  paymentObjectValidator,
  tutorApplicationObjectValidator,
  tutorObjectValidator,
  userObjectValidator,
} from "./validators";

/**
 * Syncs shared collections for demo mode.
 * When KOLEARA_ALLOW_DEMO_OTP="false" (production mode), returns only public catalog
 * (`courses` & verified `tutors`) so private PII/messages/bookings are never exposed publicly.
 */
export const getAppState = query({
  args: {},
  returns: v.object({
    seeded: v.boolean(),
    users: v.array(userObjectValidator),
    courses: v.array(courseObjectValidator),
    tutors: v.array(tutorObjectValidator),
    tutorApplications: v.array(tutorApplicationObjectValidator),
    conversations: v.array(conversationObjectValidator),
    messages: v.array(messageObjectValidator),
    bookings: v.array(bookingObjectValidator),
    payments: v.array(paymentObjectValidator),
  }),
  handler: async (ctx) => {
    const demoMode = isDemoFallbackAllowed();

    if (!demoMode) {
      const [courses, verifiedTutors] = await Promise.all([
        ctx.db.query("courses").take(50),
        ctx.db
          .query("tutors")
          .withIndex("by_verified_and_hourlyRate", (q) => q.eq("verified", true))
          .take(200),
      ]);
      return {
        seeded: courses.length > 0 && verifiedTutors.length > 0,
        users: [],
        courses: courses.map((c) => ({
          id: c.appId,
          name: c.name,
          code: c.code,
          description: c.description,
          aliases: c.aliases,
          topics: c.topics,
        })),
        tutors: await Promise.all(
          verifiedTutors.map((t) => mapTutorDoc(ctx, t)),
        ),
        tutorApplications: [],
        conversations: [],
        messages: [],
        bookings: [],
        payments: [],
      };
    }

    const [
      seedUsers,
      recentUsersDesc,
      courses,
      tutors,
      tutorApplications,
      conversations,
      latestMessagesDesc,
      latestBookingsDesc,
      latestPaymentsDesc,
    ] = await Promise.all([
      ctx.db.query("users").take(20),
      ctx.db.query("users").order("desc").take(180),
      ctx.db.query("courses").take(50),
      ctx.db.query("tutors").take(200),
      ctx.db.query("tutorApplications").order("desc").take(200),
      ctx.db.query("conversations").order("desc").take(200),
      ctx.db.query("messages").order("desc").take(500),
      ctx.db.query("bookings").order("desc").take(300),
      ctx.db.query("payments").order("desc").take(300),
    ]);
    const seenUserIds = new Set<string>();
    const users = [...seedUsers, ...[...recentUsersDesc].reverse()].filter(
      (u) => {
        if (seenUserIds.has(u.appId)) return false;
        seenUserIds.add(u.appId);
        return true;
      },
    );
    const messages = [...latestMessagesDesc].reverse();
    const bookings = [...latestBookingsDesc].reverse();
    const payments = [...latestPaymentsDesc].reverse();

    return {
      seeded: courses.length > 0 && tutors.length > 0,
      users: await Promise.all(
        users.map((u) => mapUserDoc(ctx, u, { includePrivate: false })),
      ),
      courses: courses.map((c) => ({
        id: c.appId,
        name: c.name,
        code: c.code,
        description: c.description,
        aliases: c.aliases,
        topics: c.topics,
      })),
      tutors: await Promise.all(tutors.map((t) => mapTutorDoc(ctx, t))),
      tutorApplications: tutorApplications.map((a) => ({
        id: a.appId,
        userId: a.userId,
        name: a.name,
        department: a.department,
        cohort: a.cohort,
        courseIds: a.courseIds,
        topics: a.topics,
        bio: a.bio,
        hourlyRate: a.hourlyRate,
        teachingMode: a.teachingMode,
        campusSpots: a.campusSpots,
        languages: a.languages,
        slots: a.slots,
        proofFileName: a.proofFileName,
        status: a.status,
        reviewedBy: a.reviewedBy,
        reviewedAt: a.reviewedAt,
        rejectionReason: a.rejectionReason,
        createdAt: a.createdAt,
      })),
      conversations: conversations.map((c) => ({
        id: c.appId,
        learnerId: c.learnerId,
        tutorId: c.tutorId,
        lastMessageAt: c.lastMessageAt,
      })),
      messages: messages.map((m) => ({
        id: m.appId,
        conversationId: m.conversationId,
        senderId: m.senderId,
        type: m.type,
        content: m.content,
        bookingId: m.bookingId,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
      bookings: bookings.map((b) => ({
        id: b.appId,
        conversationId: b.conversationId,
        learnerId: b.learnerId,
        tutorId: b.tutorId,
        courseId: b.courseId,
        topic: b.topic,
        startAt: b.startAt,
        durationMinutes: b.durationMinutes,
        sessionCount: b.sessionCount,
        price: b.price,
        meetingMode: b.meetingMode,
        brief: b.brief,
        difficultyTier: b.difficultyTier,
        diagnosticNotes: b.diagnosticNotes,
        agreedNoJoki: b.agreedNoJoki,
        meetingLink: canRevealSensitiveContact(b.status)
          ? b.meetingLink
          : undefined,
        status: b.status,
        escrowStatus: b.escrowStatus,
        declineReason: b.declineReason,
        paymentDeadlineAt: b.paymentDeadlineAt,
        acceptedAt: b.acceptedAt,
        paidAt: b.paidAt,
        tutorMarkedDoneAt: b.tutorMarkedDoneAt,
        completedAt: b.completedAt,
        cancelledAt: b.cancelledAt,
        cancelledBy: b.cancelledBy,
        createdAt: b.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.appId,
        bookingId: p.bookingId,
        amount: p.amount,
        status: p.status,
        paymentMethod: p.paymentMethod,
        proofName: p.proofName,
        midtransOrderId: p.midtransOrderId,
        submittedAt: p.submittedAt,
        verifiedAt: p.verifiedAt,
        paidAt: p.paidAt,
        refundedAt: p.refundedAt,
        rejectionReason: p.rejectionReason,
      })),
    };
  },
});
