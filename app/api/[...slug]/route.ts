import { timingSafeEqual } from "node:crypto";
import { matchesTutorLocation } from "@/lib/matching";
import { computePilotMetrics } from "@/lib/metrics";
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
const MAX_JSON_BODY_BYTES = 64 * 1024;

let seedEnsured = false;
let seedInFlight: Promise<void> | null = null;

async function ensureConvexSeededOnce(): Promise<void> {
  if (seedEnsured) return;
  if (!seedInFlight) {
    seedInFlight = fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "seed:ensureSeeded",
        args: {},
        format: "json",
      }),
    })
      .then((res) => {
        if (res.ok) seedEnsured = true;
      })
      .catch(() => {
        // Offline / fallback mode handled by caller
      })
      .finally(() => {
        seedInFlight = null;
      });
  }
  await seedInFlight;
}

async function callConvex(
  kind: "query" | "mutation",
  fnPath: string,
  args: Record<string, unknown>,
  options?: { skipEnsureSeed?: boolean }
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    if (
      !options?.skipEnsureSeed &&
      fnPath !== "seed:ensureSeeded" &&
      fnPath !== "seed:resetDemoData"
    ) {
      await ensureConvexSeededOnce();
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

type BodyParseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: Response };

async function readJsonBody(request: Request): Promise<BodyParseResult> {
  const declaredLen = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLen) && declaredLen > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonError(
        "Ukuran payload JSON melebihi batas 64 KB.",
        413,
        "PAYLOAD_TOO_LARGE"
      ),
    };
  }

  let text = "";
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: jsonError("Gagal membaca body request.", 400, "INVALID_BODY"),
    };
  }

  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonError(
        "Ukuran payload JSON melebihi batas 64 KB.",
        413,
        "PAYLOAD_TOO_LARGE"
      ),
    };
  }

  if (!text.trim()) {
    return { ok: true, data: {} };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> };
    }
    return {
      ok: false,
      response: jsonError(
        "Body JSON harus berupa objek.",
        400,
        "INVALID_JSON_OBJECT"
      ),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Format JSON tidak valid.", 400, "INVALID_JSON"),
    };
  }
}

function jsonSuccess(
  message: string,
  data: unknown,
  status = 200,
  meta?: Record<string, unknown>
): Response {
  return Response.json(
    {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    },
    { status }
  );
}

function jsonError(message: string, status = 400, code?: string): Response {
  return Response.json(
    {
      success: false,
      message,
      ...(code ? { error: { code, message } } : {}),
    },
    { status }
  );
}

function extractAdminKey(request: Request): string | undefined {
  const headerKey = request.headers.get("x-admin-key")?.trim();
  if (headerKey) return headerKey;
  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

// shortcut: admin routes allow keyless demo testing when KOLEARA_ADMIN_KEY is unset; set KOLEARA_ADMIN_KEY in prod to require x-admin-key / Bearer token
function verifyAdminRequest(
  request: Request
): { ok: true; adminKey?: string } | { ok: false; response: Response } {
  const expected = process.env.KOLEARA_ADMIN_KEY?.trim();
  const provided = extractAdminKey(request);
  if (!expected) {
    return { ok: true, adminKey: provided };
  }
  if (!provided) {
    return {
      ok: false,
      response: jsonError(
        "Header autentikasi admin (x-admin-key) diperlukan.",
        401,
        "UNAUTHORIZED"
      ),
    };
  }
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return {
      ok: false,
      response: jsonError("Kunci admin tidak valid.", 401, "UNAUTHORIZED"),
    };
  }
  return { ok: true, adminKey: provided };
}

function statusFromServiceCode(
  code: string | undefined,
  fallbackStatus: number
): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
    case "USER_NOT_FOUND":
    case "TUTOR_NOT_FOUND":
    case "COURSE_NOT_FOUND":
    case "CONVERSATION_NOT_FOUND":
    case "BOOKING_NOT_FOUND":
    case "PAYMENT_NOT_FOUND":
      return 404;
    case "EMAIL_EXISTS":
    case "CONFLICT":
    case "SCHEDULE_CONFLICT":
    case "ALREADY_ACCEPTED":
    case "ALREADY_DECLINED":
    case "ALREADY_PAID":
    case "ALREADY_SUBMITTED":
    case "NOT_ACCEPTED":
    case "INVALID_STATE":
      return 409;
    case "OFFER_EXPIRED":
    case "INVALID_INPUT":
    case "INVALID_EMAIL":
    case "INVALID_OTP":
    case "INVALID_NAME":
    case "INVALID_COURSE_FOR_TUTOR":
    case "SELF_CHAT_NOT_ALLOWED":
      return 400;
    default:
      return fallbackStatus;
  }
}

function computeLocalPilotMetrics() {
  const s = getDemoStateSnapshot();
  return computePilotMetrics({
    users: s.users,
    verifiedTutors: s.tutors.filter((t) => t.verified),
    pendingApplicationsCount: s.tutorApplications.length,
    conversationsCount: s.conversations.length,
    messagesCount: s.messages.length,
    bookings: s.bookings,
  });
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
    const probe = await callConvex(
      "query",
      "tutors:listCourses",
      {},
      { skipEnsureSeed: true }
    );
    return jsonSuccess("Layanan KOLEARA API aktif.", {
      status: "ok",
      engine: probe.ok ? "convex" : "mock-fallback",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. GET /api/users
  if (path === "users") {
    const roleFilter = url.searchParams.get("role")?.trim();
    if (roleFilter && roleFilter !== "learner" && roleFilter !== "tutor") {
      return jsonError(
        "Filter role harus bernilai learner atau tutor.",
        400,
        "INVALID_ROLE"
      );
    }
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

    let maxBudget: number | null = null;
    if (maxBudgetRaw !== null && maxBudgetRaw.trim() !== "") {
      const parsedBudget = Number(maxBudgetRaw);
      if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
        return jsonError(
          "Parameter max_budget harus berupa angka >= 0.",
          400,
          "INVALID_BUDGET"
        );
      }
      maxBudget = parsedBudget;
    }

    const scheduleQuery =
      url.searchParams.get("schedule") ??
      url.searchParams.get("scheduleQuery") ??
      undefined;

    const rawLocation = url.searchParams.get("location")?.trim().toLowerCase();
    if (
      rawLocation &&
      rawLocation !== "online" &&
      rawLocation !== "offline" &&
      rawLocation !== "hybrid"
    ) {
      return jsonError(
        "Parameter location harus bernilai online, offline, atau hybrid.",
        400,
        "INVALID_LOCATION"
      );
    }

    const convexRes = await callConvex("query", "tutors:searchTutors", {
      query,
      courseId,
      topic,
      maxBudget,
      scheduleQuery,
    });

    const rawResults = convexRes.ok
      ? (convexRes.value as Array<{
          tutor: { id: string; location?: "online" | "offline" | "hybrid" };
        }>)
      : tutorService.search({
          query,
          courseId,
          topic,
          maxBudget,
          scheduleQuery,
          location:
            rawLocation === "online" || rawLocation === "offline"
              ? rawLocation
              : undefined,
        });

    const results = rawLocation
      ? rawResults.filter((item) =>
          matchesTutorLocation(item.tutor, rawLocation)
        )
      : rawResults;

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
    const userId = (
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      ""
    ).trim();
    if (!userId) {
      return jsonError(
        "Query parameter user_id wajib diisi.",
        400,
        "USER_ID_REQUIRED"
      );
    }
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
    const userId = (
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      ""
    ).trim();
    if (!userId) {
      return jsonError(
        "Query parameter user_id wajib diisi.",
        400,
        "USER_ID_REQUIRED"
      );
    }
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
    const userId = (
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      ""
    ).trim();
    if (!userId) {
      return jsonError(
        "Query parameter user_id wajib diisi.",
        400,
        "USER_ID_REQUIRED"
      );
    }

    const convsRes = await callConvex("query", "chat:listConversations", {
      userId,
    });
    if (convsRes.ok) {
      const convList = convsRes.value as Array<{
        conversation: { id: string };
      }>;
      if (!convList.some((c) => c.conversation.id === conversationId)) {
        return jsonError(
          "Akses ditolak atau percakapan tidak ditemukan.",
          403,
          "FORBIDDEN"
        );
      }
      const convexRes = await callConvex("query", "chat:listMessages", {
        conversationId,
      });
      return jsonSuccess(
        "Pesan percakapan berhasil diambil.",
        convexRes.ok ? convexRes.value : []
      );
    }

    const snap = getDemoStateSnapshot();
    const conv = snap.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      return jsonError(
        "Percakapan tidak ditemukan.",
        404,
        "CONVERSATION_NOT_FOUND"
      );
    }
    const convTutor = snap.tutors.find((t) => t.id === conv.tutorId);
    if (conv.learnerId !== userId && convTutor?.userId !== userId) {
      return jsonError(
        "Hanya peserta percakapan yang dapat membaca pesan ini.",
        403,
        "FORBIDDEN"
      );
    }
    return jsonSuccess(
      "Pesan percakapan berhasil diambil.",
      chatService.listMessages(conversationId)
    );
  }

  // 11. GET /api/bookings/:booking_id
  if (slug.length === 2 && slug[0] === "bookings") {
    const bookingId = slug[1];
    const userId = (
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      ""
    ).trim();
    if (!userId) {
      return jsonError(
        "Query parameter user_id wajib diisi.",
        400,
        "USER_ID_REQUIRED"
      );
    }

    const convexRes = await callConvex("query", "bookings:getBookingById", {
      bookingId,
    });
    const booking = (
      convexRes.ok ? convexRes.value : bookingService.getById(bookingId)
    ) as { learnerId: string; tutorId: string } | null;
    if (!booking) {
      return jsonError("Data booking tidak ditemukan.", 404, "BOOKING_NOT_FOUND");
    }

    if (booking.learnerId !== userId) {
      const tutorRes = await callConvex("query", "tutors:getTutorById", {
        tutorId: booking.tutorId,
      });
      const tutor = (
        tutorRes.ok
          ? tutorRes.value
          : tutorService.getById(booking.tutorId)
      ) as { userId: string } | null;
      if (tutor?.userId !== userId) {
        return jsonError(
          "Hanya peserta pemesanan yang dapat mengakses data ini.",
          403,
          "FORBIDDEN"
        );
      }
    }
    return jsonSuccess("Data booking berhasil diambil.", booking);
  }

  // 12. GET /api/bookings/:booking_id/checkout
  if (slug.length === 3 && slug[0] === "bookings" && slug[2] === "checkout") {
    const bookingId = slug[1];
    const userId = (
      url.searchParams.get("user_id") ??
      url.searchParams.get("userId") ??
      ""
    ).trim();
    if (!userId) {
      return jsonError(
        "Query parameter user_id wajib diisi.",
        400,
        "USER_ID_REQUIRED"
      );
    }

    const convexRes = await callConvex(
      "query",
      "payments:getCheckoutByBooking",
      { bookingId }
    );
    const checkout = (
      convexRes.ok ? convexRes.value : paymentService.getByBooking(bookingId)
    ) as {
      booking: { learnerId: string };
      tutor: { userId: string };
    } | null;
    if (!checkout) {
      return jsonError(
        "Data checkout booking tidak ditemukan.",
        404,
        "CHECKOUT_NOT_FOUND"
      );
    }
    if (
      checkout.booking.learnerId !== userId &&
      checkout.tutor.userId !== userId
    ) {
      return jsonError(
        "Hanya peserta pemesanan yang dapat mengakses halaman checkout ini.",
        403,
        "FORBIDDEN"
      );
    }
    return jsonSuccess("Data checkout berhasil diambil.", checkout);
  }

  // 13. GET /api/admin/metrics
  if (path === "admin/metrics") {
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const convexRes = await callConvex("query", "metrics:getPilotMetrics", {
      ...(adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}),
    });
    if (convexRes.ok) {
      return jsonSuccess(
        "Ringkasan metrik pilot berhasil diambil.",
        convexRes.value
      );
    }
    return jsonSuccess(
      "Ringkasan metrik pilot berhasil diambil.",
      computeLocalPilotMetrics()
    );
  }

  // 14. GET /api/admin/tutor-applications
  if (path === "admin/tutor-applications") {
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const convexRes = await callConvex(
      "query",
      "admin:listPendingApplications",
      adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}
    );
    const pending = convexRes.ok
      ? convexRes.value
      : getDemoStateSnapshot().tutorApplications;
    return jsonSuccess("Antrean pengajuan tutor berhasil diambil.", pending);
  }

  // 15. GET /api/admin/payments
  if (path === "admin/payments") {
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const convexRes = await callConvex(
      "query",
      "admin:listPendingPayments",
      adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}
    );
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
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  // 1. POST /api/auth/request-otp
  if (path === "auth/request-otp") {
    const email = typeof body.email === "string" ? body.email : "";
    if (
      body.mode !== undefined &&
      body.mode !== "login" &&
      body.mode !== "signup"
    ) {
      return jsonError(
        "Parameter mode harus bernilai login atau signup.",
        400,
        "INVALID_MODE"
      );
    }
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
      return jsonError(
        res.error ?? "Gagal meminta OTP.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
    }
    return jsonSuccess("Kode OTP berhasil dikirim.", {
      email: res.data?.email,
      demo_otp: res.data?.demoOtp,
    });
  }

  // 2. POST /api/auth/verify-otp
  if (path === "auth/verify-otp") {
    const email = typeof body.email === "string" ? body.email : "";
    const otp =
      typeof body.otp === "string" || typeof body.otp === "number"
        ? String(body.otp)
        : "";
    if (
      body.mode !== undefined &&
      body.mode !== "login" &&
      body.mode !== "signup"
    ) {
      return jsonError(
        "Parameter mode harus bernilai login atau signup.",
        400,
        "INVALID_MODE"
      );
    }
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
      return jsonError(
        res.error ?? "Verifikasi OTP gagal.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
    }
    return jsonSuccess("Verifikasi OTP berhasil.", res.data);
  }

  // 3. POST /api/tutor-applications
  if (path === "tutor-applications") {
    const userId = String(body.user_id ?? body.userId ?? "");
    const name = typeof body.name === "string" ? body.name : "";
    const rawCourses = body.course_ids ?? body.courseIds;
    const courseIds = Array.isArray(rawCourses) ? rawCourses.map(String) : [];
    const topics = Array.isArray(body.topics)
      ? (body.topics as unknown[]).map(String)
      : [];
    const bio = typeof body.bio === "string" ? body.bio : "";
    const hourlyRate = Number(body.hourly_rate ?? body.hourlyRate ?? 0);
    const slots = Array.isArray(body.slots)
      ? (body.slots as unknown[]).map(String)
      : [];

    if (!Number.isSafeInteger(hourlyRate) || hourlyRate <= 0) {
      return jsonError(
        "Tarif per 60 menit harus berupa bilangan bulat positif.",
        400,
        "INVALID_INPUT"
      );
    }

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
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
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
      return jsonError(
        res.error ?? "Gagal mengirim pengajuan tutor.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
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
        statusFromServiceCode(res.code, 404),
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
    const content = typeof body.content === "string" ? body.content : "";

    const convexRes = await callConvex("mutation", "chat:sendMessage", {
      conversationId,
      senderId,
      content,
    });
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : chatService.sendMessage({ conversationId, senderId, content });

    if (!res.ok) {
      return jsonError(
        res.error ?? "Gagal mengirim pesan.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
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
    const topic = typeof body.topic === "string" ? body.topic : "";
    const startAt = Number(body.start_at ?? body.startAt ?? Number.NaN);
    const price = Number(body.price ?? Number.NaN);
    const rawMeetingMode = body.meeting_mode ?? body.meetingMode;

    if (
      rawMeetingMode !== undefined &&
      rawMeetingMode !== "online" &&
      rawMeetingMode !== "offline_its"
    ) {
      return jsonError(
        "meeting_mode harus bernilai online atau offline_its.",
        400,
        "INVALID_MEETING_MODE"
      );
    }
    if (!Number.isFinite(startAt) || !Number.isSafeInteger(price)) {
      return jsonError(
        "start_at dan price harus berupa angka bulat valid.",
        400,
        "INVALID_INPUT"
      );
    }

    const meetingMode =
      rawMeetingMode === "offline_its"
        ? ("offline_its" as const)
        : ("online" as const);
    const brief = typeof body.brief === "string" ? body.brief : undefined;

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
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
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
      return jsonError(
        res.error ?? "Gagal membuat tawaran sesi.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
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
      return jsonError(
        res.error ?? "Gagal memulai pembayaran.",
        statusFromServiceCode(res.code, 409),
        res.code
      );
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
    const rawProof = body.proof_name ?? body.proofName;
    const proofName = typeof rawProof === "string" ? rawProof : undefined;

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
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : paymentService.submitDemoProof({ bookingId, actorUserId, proofName });

    if (!res.ok) {
      return jsonError(
        res.error ?? "Gagal mengirim bukti pembayaran.",
        statusFromServiceCode(res.code, 409),
        res.code
      );
    }
    return jsonSuccess(
      "Bukti pembayaran berhasil dikirim dan menunggu verifikasi.",
      res.data
    );
  }

  // 9. POST /api/demo/reset
  if (path === "demo/reset") {
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    seedEnsured = false;
    const convexRes = await callConvex("mutation", "seed:resetDemoData", {
      ...(adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}),
    });
    if (
      convexRes.ok &&
      typeof convexRes.value === "object" &&
      convexRes.value !== null &&
      (convexRes.value as { reset?: boolean }).reset === false
    ) {
      return jsonError("Kunci admin tidak valid.", 401, "UNAUTHORIZED");
    }
    if (convexRes.ok) {
      seedEnsured = true;
    }
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
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  // 1. PATCH /api/conversations/:conversation_id/read
  if (
    slug.length === 3 &&
    slug[0] === "conversations" &&
    slug[2] === "read"
  ) {
    const conversationId = slug[1];
    const readerId = String(body.reader_id ?? body.readerId ?? "").trim();
    if (!readerId) {
      return jsonError("Field reader_id wajib diisi.", 400, "INVALID_INPUT");
    }

    const convexRes = await callConvex("mutation", "chat:markRead", {
      conversationId,
      readerId,
    });

    if (convexRes.ok && convexRes.value && typeof convexRes.value === "object") {
      const val = convexRes.value as {
        ok: boolean;
        error?: string;
        code?: string;
      };
      if (!val.ok) {
        return jsonError(
          val.error ?? "Gagal menandai pesan dibaca.",
          statusFromServiceCode(val.code, 400),
          val.code
        );
      }
      chatService.markRead(conversationId, readerId);
      return jsonSuccess("Seluruh pesan ditandai sudah dibaca.", {
        conversation_id: conversationId,
        read: true,
      });
    }

    const fallbackRes = chatService.markRead(conversationId, readerId);
    if (!convexRes.ok && !fallbackRes.ok) {
      return jsonError(
        fallbackRes.error,
        statusFromServiceCode(fallbackRes.code, 400),
        fallbackRes.code
      );
    }

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
      return jsonError(
        res.error ?? "Gagal menerima tawaran.",
        statusFromServiceCode(res.code, 400),
        res.code
      );
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
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : bookingService.declineOffer({ bookingId, actorUserId });

    if (!res.ok) {
      return jsonError(
        res.error ?? "Gagal menolak tawaran.",
        statusFromServiceCode(res.code, 409),
        res.code
      );
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
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const bookingId = slug[1];
    if (body.decision !== "approve" && body.decision !== "reject") {
      return jsonError(
        "Field decision wajib bernilai approve atau reject.",
        400,
        "INVALID_DECISION"
      );
    }
    const decision = body.decision;

    const convexRes = await callConvex(
      "mutation",
      "payments:simulateVerification",
      {
        bookingId,
        decision,
        ...(adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}),
      }
    );
    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : paymentService.simulateVerification({ bookingId, decision });

    if (!res.ok) {
      return jsonError(
        res.error ?? "Gagal memperbarui status pembayaran.",
        statusFromServiceCode(res.code, 409),
        res.code
      );
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
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const applicationId = slug[2];
    const department =
      typeof body.department === "string" ? body.department : undefined;
    const cohort =
      body.cohort !== undefined ? Number(body.cohort) : undefined;

    if (
      cohort !== undefined &&
      (!Number.isInteger(cohort) || cohort < 2000 || cohort > 2035)
    ) {
      return jsonError(
        "Angkatan (cohort) harus berupa tahun bulat antara 2000–2035.",
        400,
        "INVALID_COHORT"
      );
    }

    if (
      body.badge !== undefined &&
      body.badge !== "grade" &&
      body.badge !== "asdos"
    ) {
      return jsonError(
        "Field badge harus bernilai grade atau asdos.",
        400,
        "INVALID_BADGE"
      );
    }
    const badge = body.badge === "asdos" ? ("asdos" as const) : ("grade" as const);

    const convexRes = await callConvex(
      "mutation",
      "admin:approveTutorApplication",
      {
        applicationId,
        department,
        cohort,
        badge,
        ...(adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}),
      }
    );

    const res = convexRes.ok
      ? (convexRes.value as {
          ok: boolean;
          data?: unknown;
          error?: string;
          code?: string;
        })
      : tutorService.approveApplication({
          applicationId,
          department,
          cohort,
          badge,
        });

    if (!res.ok) {
      return jsonError(
        res.error ?? "Pengajuan tidak ditemukan.",
        statusFromServiceCode(res.code, 404),
        res.code
      );
    }
    return jsonSuccess(
      "Pengajuan tutor disetujui dan profil tutor telah aktif.",
      res.data
    );
  }

  return jsonError(`Endpoint PATCH /api/${path} tidak ditemukan.`, 404);
}

// ============================================================================
// DELETE HANDLERS
// ============================================================================
export async function DELETE(
  request: Request,
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
    const adminCheck = verifyAdminRequest(request);
    if (!adminCheck.ok) return adminCheck.response;

    const applicationId = slug[2];
    const convexRes = await callConvex(
      "mutation",
      "admin:rejectTutorApplication",
      {
        applicationId,
        ...(adminCheck.adminKey ? { adminKey: adminCheck.adminKey } : {}),
      }
    );

    const val: { rejected: boolean; unauthorized?: boolean } = convexRes.ok
      ? (convexRes.value as { rejected: boolean; unauthorized?: boolean })
      : tutorService.rejectApplication(applicationId);

    if (val.unauthorized) {
      return jsonError("Kunci admin tidak valid.", 401, "UNAUTHORIZED");
    }
    if (!val.rejected) {
      return jsonError(
        "Pengajuan tutor tidak ditemukan.",
        404,
        "APPLICATION_NOT_FOUND"
      );
    }
    return jsonSuccess(
      "Pengajuan tutor telah ditolak dan dihapus dari antrean.",
      { rejected: true }
    );
  }

  return jsonError(`Endpoint DELETE /api/${path} tidak ditemukan.`, 404);
}
