import { NextResponse } from "next/server";
import {
  authService,
  bookingService,
  chatService,
  courseService,
  getDemoStateSnapshot,
  paymentService,
  tutorService,
} from "@/lib/mock";

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";

async function callConvex(
  kind: "query" | "mutation",
  fnPath: string,
  args: Record<string, unknown>
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    if (fnPath !== "seed:ensureSeeded" && fnPath !== "seed:resetDemoData") {
      await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "seed:ensureSeeded",
          args: {},
          format: "json",
        }),
      });
    }

    const res = await fetch(`${CONVEX_URL}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: fnPath,
        args,
        format: "json",
      }),
    });
    const payload: unknown = await res.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      (payload as Record<string, unknown>).status === "success"
    ) {
      return {
        ok: true,
        value: (payload as Record<string, unknown>).value ?? null,
      };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function jsonSuccess(
  message: string,
  data: unknown,
  status = 200,
  meta?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(code ? { error: { code, message } } : {}),
    },
    { status }
  );
}

// ============================================================================
// GET HANDLERS
// ============================================================================
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const path = slug.join("/");

  // 1. GET /api/health
  if (path === "health") {
    return jsonSuccess("Layanan KOLEARA API aktif.", {
      status: "ok",
      engine: "convex",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. GET /api/users
  if (path === "users") {
    const roleFilter = url.searchParams.get("role")?.trim();
    const convexRes = await callConvex("query", "auth:listUsers", {});
    const users = (
      convexRes.ok
        ? (convexRes.value as Array<{ role: string }>)
        : getDemoStateSnapshot().users
    ).filter((u) => (!roleFilter ? true : u.role === roleFilter));
    return jsonSuccess("Data user berhasil diambil.", users, 200, {
      count: users.length,
    });
  }

  // 3. GET /api/users/:user_id
  if (slug.length === 2 && slug[0] === "users") {
    const userId = slug[1];
    const convexRes = await callConvex("query", "auth:getUserById", { userId });
    const user = convexRes.ok
      ? convexRes.value
      : getDemoStateSnapshot().users.find((u) => u.id === userId) ?? null;
    if (!user) return jsonError("User tidak ditemukan.", 404, "USER_NOT_FOUND");
    return jsonSuccess("Detail user berhasil diambil.", user);
  }

  // 4. GET /api/courses
  if (path === "courses") {
    const convexRes = await callConvex("query", "tutors:listCourses", {});
    const courses = convexRes.ok ? convexRes.value : courseService.list();
    return jsonSuccess("Data mata kuliah berhasil diambil.", courses);
  }

  // 5. GET /api/courses/:course_id/topics
  if (slug.length === 3 && slug[0] === "courses" && slug[2] === "topics") {
    const courseId = slug[1];
    const convexRes = await callConvex("query", "tutors:getTopics", {
      courseId,
    });
    const topics = convexRes.ok
      ? (convexRes.value as string[])
      : courseService.getTopics(courseId);
    if (!topics || topics.length === 0) {
      return jsonError("Mata kuliah tidak ditemukan.", 404, "COURSE_NOT_FOUND");
    }
    return jsonSuccess("Daftar subtopik berhasil diambil.", topics);
  }

  // 6. GET /api/tutors
  if (path === "tutors") {
    const query = url.searchParams.get("query") ?? undefined;
    const courseId =
      url.searchParams.get("course_id") ??
      url.searchParams.get("courseId") ??
      undefined;
    const topic = url.searchParams.get("topic") ?? undefined;
    const maxBudgetRaw =
      url.searchParams.get("max_budget") ?? url.searchParams.get("maxBudget");
    const maxBudget =
      maxBudgetRaw !== null && maxBudgetRaw.trim() !== ""
        ? Number(maxBudgetRaw)
        : null;
    const scheduleQuery =
      url.searchParams.get("schedule") ??
      url.searchParams.get("scheduleQuery") ??
      undefined;

    const convexRes = await callConvex("query", "tutors:searchTutors", {
      query,
      courseId,
      topic,
      maxBudget: Number.isFinite(maxBudget) ? maxBudget : null,
      scheduleQuery,
    });

    const results = convexRes.ok
      ? (convexRes.value as unknown[])
      : tutorService.search({
          query,
          courseId,
          topic,
          maxBudget: Number.isFinite(maxBudget) ? maxBudget : null,
          scheduleQuery,
        });

    return jsonSuccess("Daftar tutor berhasil diambil.", results, 200, {
      count: results.length,
    });
  }

  // 7. GET /api/tutors/:tutor_id
  if (slug.length === 2 && slug[0] === "tutors") {
    const tutorId = slug[1];
    const convexRes = await callConvex("query", "tutors:getTutorById", {
      tutorId,
    });
    const tutor = convexRes.ok ? convexRes.value : tutorService.getById(tutorId);
    if (!tutor) {
      return jsonError("Profil tutor tidak ditemukan.", 404, "TUTOR_NOT_FOUND");
    }
    return jsonSuccess("Detail tutor berhasil diambil.", tutor);
  }

  // 8. GET /api/tutor-applications
  if (path === "tutor-applications") {
    const userId =
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      "user-learner-demo";
    const convexRes = await callConvex("query", "tutors:listApplications", {
      userId,
    });
    const apps = convexRes.ok
      ? convexRes.value
      : tutorService.listApplications(userId);
    return jsonSuccess("Data pengajuan tutor berhasil diambil.", apps);
  }

  // 9. GET /api/conversations
  if (path === "conversations") {
    const userId =
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      "user-learner-demo";
    const convexRes = await callConvex("query", "chat:listConversations", {
      userId,
    });
    const list = convexRes.ok
      ? convexRes.value
      : chatService.listConversations(userId);
    return jsonSuccess("Daftar percakapan berhasil diambil.", list);
  }

  // 10. GET /api/conversations/:conversation_id/messages
  if (
    slug.length === 3 &&
    slug[0] === "conversations" &&
    slug[2] === "messages"
  ) {
    const conversationId = slug[1];
    const convexRes = await callConvex("query", "chat:listMessages", {
      conversationId,
    });
    const messages = convexRes.ok
      ? convexRes.value
      : chatService.listMessages(conversationId);
    return jsonSuccess("Pesan percakapan berhasil diambil.", messages);
  }

  // 11. GET /api/bookings/:booking_id
  if (slug.length === 2 && slug[0] === "bookings") {
    const bookingId = slug[1];
    const convexRes = await callConvex("query", "bookings:getBookingById", {
      bookingId,
    });
    const booking = convexRes.ok
      ? convexRes.value
      : bookingService.getById(bookingId);
    if (!booking) {
      return jsonError("Data booking tidak ditemukan.", 404, "BOOKING_NOT_FOUND");
    }
    return jsonSuccess("Data booking berhasil diambil.", booking);
  }

  // 12. GET /api/bookings/:booking_id/checkout
  if (slug.length === 3 && slug[0] === "bookings" && slug[2] === "checkout") {
    const bookingId = slug[1];
    const convexRes = await callConvex(
      "query",
      "payments:getCheckoutByBooking",
      { bookingId }
    );
    const checkout = convexRes.ok
      ? convexRes.value
      : paymentService.getByBooking(bookingId);
    if (!checkout) {
      return jsonError(
        "Data checkout booking tidak ditemukan.",
        404,
        "CHECKOUT_NOT_FOUND"
      );
    }
    return jsonSuccess("Data checkout berhasil diambil.", checkout);
  }

  // 13. GET /api/admin/metrics
  if (path === "admin/metrics") {
    const convexRes = await callConvex("query", "metrics:getPilotMetrics", {});
    if (convexRes.ok) {
      return jsonSuccess(
        "Ringkasan metrik pilot berhasil diambil.",
        convexRes.value
      );
    }
    const s = getDemoStateSnapshot();
    return jsonSuccess("Ringkasan metrik pilot berhasil diambil.", {
      totalUsers: s.users.length,
      totalLearners: s.users.filter((u) => u.role === "learner").length,
      totalVerifiedTutors: s.tutors.filter((t) => t.verified).length,
      pendingTutorApplications: s.tutorApplications.length,
      totalConversations: s.conversations.length,
      totalMessages: s.messages.length,
      totalBookings: s.bookings.length,
    });
  }

  // 14. GET /api/admin/tutor-applications
  if (path === "admin/tutor-applications") {
    const convexRes = await callConvex(
      "query",
      "admin:listPendingApplications",
      {}
    );
    const pending = convexRes.ok
      ? convexRes.value
      : getDemoStateSnapshot().tutorApplications;
    return jsonSuccess("Antrean pengajuan tutor berhasil diambil.", pending);
  }

  // 15. GET /api/admin/payments
  if (path === "admin/payments") {
    const convexRes = await callConvex("query", "admin:listPendingPayments", {});
    const pending = convexRes.ok
      ? convexRes.value
      : getDemoStateSnapshot().payments.filter(
          (p) => p.status === "pending_verification"
        );
    return jsonSuccess("Antrean pembayaran berhasil diambil.", pending);
  }

  return jsonError(`Endpoint GET /api/${path} tidak ditemukan.`, 404);
}

// ============================================================================
// POST HANDLERS
// ============================================================================
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const body = await readJsonBody(request);

  // 1. POST /api/auth/request-otp
  if (path === "auth/request-otp") {
    const email = String(body.email ?? "");
    const mode = body.mode === "signup" ? "signup" : "login";
    const name = typeof body.name === "string" ? body.name : undefined;

    const convexRes = await callConvex("mutation", "auth:requestDemoOtp", {
      email,
      mode,
      name,
    });
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: { email: string; demoOtp: string };
          error?: string;
          code?: string;
        })
      : authService.requestDemoOtp({ email, mode, name });

    if (!res.ok) {
      const status =
        res.code === "USER_NOT_FOUND"
          ? 404
          : res.code === "EMAIL_EXISTS"
            ? 409
            : 400;
      return jsonError(res.error ?? "Gagal meminta OTP.", status, res.code);
    }
    return jsonSuccess("Kode OTP berhasil dikirim.", {
      email: res.data?.email,
      demo_otp: res.data?.demoOtp,
    });
  }

  // 2. POST /api/auth/verify-otp
  if (path === "auth/verify-otp") {
    const email = String(body.email ?? "");
    const otp = String(body.otp ?? "");
    const mode = body.mode === "signup" ? "signup" : "login";
    const name = typeof body.name === "string" ? body.name : undefined;

    const convexRes = await callConvex("mutation", "auth:verifyDemoOtp", {
      email,
      otp,
      mode,
      name,
    });
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : authService.verifyDemoOtp({ email, otp, mode, name });

    if (!res.ok) {
      const status =
        res.code === "USER_NOT_FOUND"
          ? 404
          : res.code === "EMAIL_EXISTS"
            ? 409
            : 400;
      return jsonError(res.error ?? "Verifikasi OTP gagal.", status, res.code);
    }
    return jsonSuccess("Verifikasi OTP berhasil.", res.data);
  }

  // 3. POST /api/tutor-applications
  if (path === "tutor-applications") {
    const userId = String(body.user_id ?? body.userId ?? "");
    const name = String(body.name ?? "");
    const courseIds = Array.isArray(body.course_ids ?? body.courseIds)
      ? ((body.course_ids ?? body.courseIds) as unknown[]).map(String)
      : [];
    const topics = Array.isArray(body.topics)
      ? (body.topics as unknown[]).map(String)
      : [];
    const bio = String(body.bio ?? "");
    const hourlyRate = Number(body.hourly_rate ?? body.hourlyRate ?? 0);
    const slots = Array.isArray(body.slots)
      ? (body.slots as unknown[]).map(String)
      : [];

    const convexRes = await callConvex(
      "mutation",
      "tutors:submitApplication",
      {
        userId,
        name,
        courseIds,
        topics,
        bio,
        hourlyRate,
        slots,
      }
    );

    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : tutorService.submitApplication({
          userId,
          name,
          courseIds,
          topics,
          bio,
          hourlyRateRaw: hourlyRate,
          slots,
        });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal mengirim pengajuan tutor.", 400);
    }
    return jsonSuccess(
      "Pengajuan pendaftaran tutor berhasil dikirim.",
      res.data,
      201
    );
  }

  // 4. POST /api/conversations
  if (path === "conversations") {
    const learnerId = String(body.learner_id ?? body.learnerId ?? "");
    const tutorId = String(body.tutor_id ?? body.tutorId ?? "");

    const convexRes = await callConvex(
      "mutation",
      "chat:getOrCreateConversation",
      { learnerId, tutorId }
    );
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : chatService.getOrCreateConversation(learnerId, tutorId);

    if (!res.ok) {
      return jsonError(
        res.error ?? "Gagal membuka percakapan.",
        res.code === "SELF_CHAT_NOT_ALLOWED" ? 400 : 404,
        res.code
      );
    }
    return jsonSuccess("Ruang percakapan siap.", res.data);
  }

  // 5. POST /api/conversations/:conversation_id/messages
  if (
    slug.length === 3 &&
    slug[0] === "conversations" &&
    slug[2] === "messages"
  ) {
    const conversationId = slug[1];
    const senderId = String(body.sender_id ?? body.senderId ?? "");
    const content = String(body.content ?? "");

    const convexRes = await callConvex("mutation", "chat:sendMessage", {
      conversationId,
      senderId,
      content,
    });
    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : chatService.sendMessage({ conversationId, senderId, content });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal mengirim pesan.", 400);
    }
    return jsonSuccess("Pesan berhasil dikirim.", res.data, 201);
  }

  // 6. POST /api/conversations/:conversation_id/offers
  if (
    slug.length === 3 &&
    slug[0] === "conversations" &&
    slug[2] === "offers"
  ) {
    const conversationId = slug[1];
    const actorUserId = String(body.actor_user_id ?? body.actorUserId ?? "");
    const courseId = String(body.course_id ?? body.courseId ?? "");
    const topic = String(body.topic ?? "");
    const startAt = Number(body.start_at ?? body.startAt ?? 0);
    const price = Number(body.price ?? 0);
    const meetingMode =
      (body.meeting_mode ?? body.meetingMode) === "offline_its"
        ? ("offline_its" as const)
        : ("online" as const);
    const brief =
      typeof body.brief === "string" ? body.brief : undefined;

    const convexRes = await callConvex("mutation", "bookings:createOffer", {
      conversationId,
      actorUserId,
      courseId,
      topic,
      startAt,
      price,
      meetingMode,
      brief,
    });
    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : bookingService.createOffer({
          conversationId,
          actorUserId,
          courseId,
          topic,
          startAt,
          priceRaw: price,
          meetingMode,
          brief,
        });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal membuat tawaran sesi.", 400);
    }
    return jsonSuccess(
      "Tawaran sesi berhasil dikirim ke ruang chat.",
      res.data,
      201
    );
  }

  // 7. POST /api/bookings/:booking_id/payment/start
  if (
    slug.length === 4 &&
    slug[0] === "bookings" &&
    slug[2] === "payment" &&
    slug[3] === "start"
  ) {
    const bookingId = slug[1];
    const actorUserId = String(body.actor_user_id ?? body.actorUserId ?? "");

    const convexRes = await callConvex("mutation", "payments:startPayment", {
      bookingId,
      actorUserId,
    });
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : paymentService.startPayment({ bookingId, actorUserId });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal memulai pembayaran.", 409, res.code);
    }
    return jsonSuccess("Silakan lakukan pembayaran melalui QRIS.", res.data);
  }

  // 8. POST /api/bookings/:booking_id/payment/proof
  if (
    slug.length === 4 &&
    slug[0] === "bookings" &&
    slug[2] === "payment" &&
    slug[3] === "proof"
  ) {
    const bookingId = slug[1];
    const actorUserId = String(body.actor_user_id ?? body.actorUserId ?? "");
    const proofName =
      typeof (body.proof_name ?? body.proofName) === "string"
        ? String(body.proof_name ?? body.proofName)
        : undefined;

    const convexRes = await callConvex(
      "mutation",
      "payments:submitDemoProof",
      {
        bookingId,
        actorUserId,
        proofName,
      }
    );
    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : paymentService.submitDemoProof({ bookingId, actorUserId, proofName });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal mengirim bukti pembayaran.", 409);
    }
    return jsonSuccess(
      "Bukti pembayaran berhasil dikirim dan menunggu verifikasi.",
      res.data
    );
  }

  // 9. POST /api/demo/reset
  if (path === "demo/reset") {
    await callConvex("mutation", "seed:resetDemoData", {});
    authService.resetDemo();
    return jsonSuccess(
      "Seluruh data demo berhasil direset ke kondisi awal.",
      { reset: true }
    );
  }

  return jsonError(`Endpoint POST /api/${path} tidak ditemukan.`, 404);
}

// ============================================================================
// PATCH HANDLERS
// ============================================================================
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");
  const body = await readJsonBody(request);

  // 1. PATCH /api/conversations/:conversation_id/read
  if (
    slug.length === 3 &&
    slug[0] === "conversations" &&
    slug[2] === "read"
  ) {
    const conversationId = slug[1];
    const readerId = String(body.reader_id ?? body.readerId ?? "");
    await callConvex("mutation", "chat:markRead", {
      conversationId,
      readerId,
    });
    chatService.markRead(conversationId, readerId);
    return jsonSuccess("Seluruh pesan ditandai sudah dibaca.", {
      conversation_id: conversationId,
      read: true,
    });
  }

  // 2. PATCH /api/bookings/:booking_id/accept
  if (slug.length === 3 && slug[0] === "bookings" && slug[2] === "accept") {
    const bookingId = slug[1];
    const actorUserId = String(body.actor_user_id ?? body.actorUserId ?? "");

    const convexRes = await callConvex("mutation", "bookings:acceptOffer", {
      bookingId,
      actorUserId,
    });
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : bookingService.acceptOffer({ bookingId, actorUserId });

    if (!res.ok) {
      const status =
        res.code === "SCHEDULE_CONFLICT" ||
        res.code === "ALREADY_ACCEPTED" ||
        res.code === "ALREADY_DECLINED"
          ? 409
          : 400;
      return jsonError(res.error ?? "Gagal menerima tawaran.", status, res.code);
    }
    return jsonSuccess(
      "Tawaran sesi berhasil diterima. Silakan lanjutkan ke pembayaran.",
      res.data
    );
  }

  // 3. PATCH /api/bookings/:booking_id/decline
  if (slug.length === 3 && slug[0] === "bookings" && slug[2] === "decline") {
    const bookingId = slug[1];
    const actorUserId = String(body.actor_user_id ?? body.actorUserId ?? "");

    const convexRes = await callConvex("mutation", "bookings:declineOffer", {
      bookingId,
      actorUserId,
    });
    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : bookingService.declineOffer({ bookingId, actorUserId });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal menolak tawaran.", 409);
    }
    return jsonSuccess("Tawaran sesi telah ditolak.", res.data);
  }

  // 4. PATCH /api/bookings/:booking_id/payment/status
  if (
    slug.length === 4 &&
    slug[0] === "bookings" &&
    slug[2] === "payment" &&
    slug[3] === "status"
  ) {
    const bookingId = slug[1];
    const decision = body.decision === "reject" ? "reject" : "approve";

    const convexRes = await callConvex(
      "mutation",
      "payments:simulateVerification",
      {
        bookingId,
        decision,
      }
    );
    const res = convexRes.ok
      ? (convexRes.value as { ok: boolean; data?: unknown; error?: string })
      : paymentService.simulateVerification({ bookingId, decision });

    if (!res.ok) {
      return jsonError(res.error ?? "Gagal memperbarui status pembayaran.", 409);
    }
    return jsonSuccess("Status pembayaran berhasil diperbarui.", res.data);
  }

  // 5. PATCH /api/admin/tutor-applications/:application_id/approve
  if (
    slug.length === 4 &&
    slug[0] === "admin" &&
    slug[1] === "tutor-applications" &&
    slug[3] === "approve"
  ) {
    const applicationId = slug[2];
    const department =
      typeof body.department === "string" ? body.department : undefined;
    const cohort =
      typeof body.cohort === "number" ? body.cohort : undefined;
    const badge =
      body.badge === "asdos" ? ("asdos" as const) : ("grade" as const);

    const convexRes = await callConvex(
      "mutation",
      "admin:approveTutorApplication",
      {
        applicationId,
        department,
        cohort,
        badge,
      }
    );

    if (convexRes.ok) {
      const res = convexRes.value as {
        ok: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok) return jsonError(res.error ?? "Pengajuan tidak ditemukan.", 404);
      return jsonSuccess(
        "Pengajuan tutor disetujui dan profil tutor telah aktif.",
        res.data
      );
    }
    return jsonError("Pengajuan tutor tidak ditemukan.", 404);
  }

  return jsonError(`Endpoint PATCH /api/${path} tidak ditemukan.`, 404);
}

// ============================================================================
// DELETE HANDLERS
// ============================================================================
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = slug.join("/");

  // 1. DELETE /api/admin/tutor-applications/:application_id
  if (
    slug.length === 3 &&
    slug[0] === "admin" &&
    slug[1] === "tutor-applications"
  ) {
    const applicationId = slug[2];
    const convexRes = await callConvex(
      "mutation",
      "admin:rejectTutorApplication",
      { applicationId }
    );
    if (convexRes.ok) {
      const val = convexRes.value as { rejected: boolean };
      if (!val.rejected) {
        return jsonError("Pengajuan tutor tidak ditemukan.", 404);
      }
      return jsonSuccess(
        "Pengajuan tutor telah ditolak dan dihapus dari antrean.",
        val
      );
    }
    return jsonError("Pengajuan tutor tidak ditemukan.", 404);
  }

  return jsonError(`Endpoint DELETE /api/${path} tidak ditemukan.`, 404);
}
