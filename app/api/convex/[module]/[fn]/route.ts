import { NextResponse } from "next/server";
import { API_ENDPOINTS_CATALOG } from "@/lib/openapi";
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

function executeLocalFallback(
  moduleName: string,
  fnName: string,
  args: Record<string, unknown>
): unknown {
  const key = `${moduleName}:${fnName}`;
  switch (key) {
    case "auth:listUsers":
      return getDemoStateSnapshot().users;
    case "auth:getUserById":
      return (
        getDemoStateSnapshot().users.find((u) => u.id === args.userId) ?? null
      );
    case "auth:requestDemoOtp":
      return authService.requestDemoOtp({
        email: String(args.email ?? ""),
        mode: args.mode === "signup" ? "signup" : "login",
        name: typeof args.name === "string" ? args.name : undefined,
      });
    case "auth:verifyDemoOtp":
      return authService.verifyDemoOtp({
        email: String(args.email ?? ""),
        otp: String(args.otp ?? ""),
        mode: args.mode === "signup" ? "signup" : "login",
        name: typeof args.name === "string" ? args.name : undefined,
      });
    case "tutors:listCourses":
      return courseService.list();
    case "tutors:getTopics":
      return courseService.getTopics(
        typeof args.courseId === "string" ? args.courseId : undefined
      );
    case "tutors:listVerifiedTutors":
      return tutorService.list();
    case "tutors:getTutorById":
      return tutorService.getById(String(args.tutorId ?? ""));
    case "tutors:searchTutors":
      return tutorService.search({
        query: typeof args.query === "string" ? args.query : undefined,
        courseId: typeof args.courseId === "string" ? args.courseId : undefined,
        topic: typeof args.topic === "string" ? args.topic : undefined,
        maxBudget: typeof args.maxBudget === "number" ? args.maxBudget : null,
        scheduleQuery:
          typeof args.scheduleQuery === "string"
            ? args.scheduleQuery
            : undefined,
      });
    case "tutors:submitApplication":
      return tutorService.submitApplication({
        userId: String(args.userId ?? ""),
        name: String(args.name ?? ""),
        courseIds: Array.isArray(args.courseIds)
          ? args.courseIds.map(String)
          : [],
        topics: Array.isArray(args.topics) ? args.topics.map(String) : [],
        bio: String(args.bio ?? ""),
        hourlyRateRaw: Number(args.hourlyRate ?? 0),
        slots: Array.isArray(args.slots) ? args.slots.map(String) : [],
      });
    case "tutors:listApplications":
      return tutorService.listApplications(String(args.userId ?? ""));
    case "chat:getOrCreateConversation":
      return chatService.getOrCreateConversation(
        String(args.learnerId ?? ""),
        String(args.tutorId ?? "")
      );
    case "chat:listConversations":
      return chatService.listConversations(String(args.userId ?? ""));
    case "chat:listMessages":
      return chatService.listMessages(String(args.conversationId ?? ""));
    case "chat:sendMessage":
      return chatService.sendMessage({
        conversationId: String(args.conversationId ?? ""),
        senderId: String(args.senderId ?? ""),
        content: String(args.content ?? ""),
      });
    case "chat:markRead":
      chatService.markRead(
        String(args.conversationId ?? ""),
        String(args.readerId ?? "")
      );
      return null;
    case "bookings:getBookingById":
      return bookingService.getById(String(args.bookingId ?? ""));
    case "bookings:createOffer":
      return bookingService.createOffer({
        conversationId: String(args.conversationId ?? ""),
        actorUserId: String(args.actorUserId ?? ""),
        courseId: String(args.courseId ?? ""),
        topic: String(args.topic ?? ""),
        startAt: Number(args.startAt ?? 0),
        priceRaw: Number(args.price ?? 0),
        meetingMode:
          args.meetingMode === "offline_its" ? "offline_its" : "online",
        brief: typeof args.brief === "string" ? args.brief : undefined,
      });
    case "bookings:acceptOffer":
      return bookingService.acceptOffer({
        bookingId: String(args.bookingId ?? ""),
        actorUserId: String(args.actorUserId ?? ""),
      });
    case "bookings:declineOffer":
      return bookingService.declineOffer({
        bookingId: String(args.bookingId ?? ""),
        actorUserId: String(args.actorUserId ?? ""),
      });
    case "payments:getCheckoutByBooking":
      return paymentService.getByBooking(String(args.bookingId ?? ""));
    case "payments:startPayment":
      return paymentService.startPayment({
        bookingId: String(args.bookingId ?? ""),
        actorUserId: String(args.actorUserId ?? ""),
      });
    case "payments:submitDemoProof":
      return paymentService.submitDemoProof({
        bookingId: String(args.bookingId ?? ""),
        actorUserId: String(args.actorUserId ?? ""),
        proofName:
          typeof args.proofName === "string" ? args.proofName : undefined,
      });
    case "payments:simulateVerification":
      return paymentService.simulateVerification({
        bookingId: String(args.bookingId ?? ""),
        decision: args.decision === "reject" ? "reject" : "approve",
      });
    case "state:getAppState": {
      const s = getDemoStateSnapshot();
      return {
        seeded: true,
        users: s.users,
        courses: s.courses,
        tutors: s.tutors,
        tutorApplications: s.tutorApplications,
        conversations: s.conversations,
        messages: s.messages,
        bookings: s.bookings,
        payments: s.payments,
      };
    }
    case "seed:ensureSeeded":
      return { seeded: false };
    case "seed:resetDemoData":
      authService.resetDemo();
      return { reset: true };
    default:
      return { message: "Executed via local fallback" };
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ module: string; fn: string }> }
) {
  const { module: moduleName, fn: fnName } = await context.params;
  const endpoint = API_ENDPOINTS_CATALOG.find(
    (e) => e.module === moduleName && e.fn === fnName
  );

  if (!endpoint) {
    return NextResponse.json(
      {
        ok: false,
        error: `Endpoint Convex '${moduleName}:${fnName}' tidak terdaftar di katalog OpenAPI.`,
      },
      { status: 404 }
    );
  }

  let args: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body request harus berupa JSON objek yang valid." },
      { status: 400 }
    );
  }

  // Ensure Convex DB is seeded before running queries against local Convex deployment
  try {
    if (endpoint.module !== "seed") {
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

    const convexRes = await fetch(`${CONVEX_URL}/api/${endpoint.kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `${moduleName}:${fnName}`,
        args,
        format: "json",
      }),
    });

    const payload: unknown = await convexRes.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "status" in payload &&
      (payload as Record<string, unknown>).status === "success"
    ) {
      return NextResponse.json({
        ok: true,
        source: "convex-database",
        function: `${moduleName}:${fnName}`,
        kind: endpoint.kind,
        result: (payload as Record<string, unknown>).value ?? null,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        source: "convex-database",
        function: `${moduleName}:${fnName}`,
        kind: endpoint.kind,
        error: payload,
      },
      { status: 400 }
    );
  } catch {
    // Fallback to in-memory service if Convex port 3210 is not running
    const fallbackResult = executeLocalFallback(moduleName, fnName, args);
    return NextResponse.json({
      ok: true,
      source: "local-fallback",
      function: `${moduleName}:${fnName}`,
      kind: endpoint.kind,
      result: fallbackResult,
    });
  }
}
