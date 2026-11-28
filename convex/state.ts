import { v } from "convex/values";
import { query } from "./_generated/server";
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

// shortcut: demo mode syncs shared collections to power the multi-role switcher UI; scope per-user with ctx.auth when moving off demo mode
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
      users: users.map((u) => ({
        id: u.appId,
        email: u.email,
        name: u.name,
        role: u.role,
      })),
      courses: courses.map((c) => ({
        id: c.appId,
        name: c.name,
        code: c.code,
        description: c.description,
        topics: c.topics,
      })),
      tutors: tutors.map((t) => ({
        id: t.appId,
        userId: t.userId,
        name: t.name,
        department: t.department,
        cohort: t.cohort,
        bio: t.bio,
        courseIds: t.courseIds,
        topics: t.topics,
        hourlyRate: t.hourlyRate,
        verified: t.verified,
        badge: t.badge,
        rating: t.rating,
        completedSessionsDemo: t.completedSessionsDemo,
        location: t.location,
        slots: t.slots,
      })),
      tutorApplications: tutorApplications.map((a) => ({
        id: a.appId,
        userId: a.userId,
        name: a.name,
        courseIds: a.courseIds,
        topics: a.topics,
        bio: a.bio,
        hourlyRate: a.hourlyRate,
        slots: a.slots,
        status: a.status,
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
        price: b.price,
        meetingMode: b.meetingMode,
        brief: b.brief,
        status: b.status,
        createdAt: b.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.appId,
        bookingId: p.bookingId,
        amount: p.amount,
        status: p.status,
        proofName: p.proofName,
        submittedAt: p.submittedAt,
        verifiedAt: p.verifiedAt,
        rejectionReason: p.rejectionReason,
      })),
    };
  },
});
