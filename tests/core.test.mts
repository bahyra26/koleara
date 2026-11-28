import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  formatIdr,
  formatWibClockTime,
  parseWibDateTimeLocal,
  resolveNextSlotTimestampWib,
  toWibDateTimeLocalValue,
} from "@/lib/formatters";
import { buildTutorScheduleMatrix } from "@/lib/tutorDisplay";
import { calculateBriefMatchScore, rankVerifiedTutors } from "@/lib/matching";
import {
  authService,
  bookingService,
  chatService,
  DEMO_STORAGE_KEY,
  hydrateDemoStore,
  isValidDemoState,
  paymentService,
  resetDemoStore,
  tutorService,
} from "@/lib/mock";
import { applyRemoteCollections, getDemoStateSnapshot } from "@/lib/mock/store";
import { DELETE, GET, PATCH, POST } from "@/app/api/[...slug]/route";
import {
  evaluateCancellationRefund,
  extractCohortYearFromNrp,
  extractNrpFromItsEmail,
  sanitizeReturnPath,
  sha512Hex,
  validateDemoOtp,
  validateItsEmail,
  validateWhatsappNumber,
  verifyMidtransSignature,
} from "@/lib/validators";
import { computePilotMetrics } from "@/lib/metrics";
import { POST as MIDTRANS_WEBHOOK_POST } from "@/app/api/midtrans/webhook/route";

beforeEach(() => {
  resetDemoStore();
});

describe("validators & WIB formatters", () => {
  it("normalizes and validates 10-digit ITS student emails", () => {
    const ok = validateItsEmail("  0000000099@STUDENT.ITS.AC.ID ");
    assert.equal(ok.valid, true);
    assert.equal(ok.normalized, "0000000099@student.its.ac.id");

    assert.equal(validateItsEmail("123@student.its.ac.id").valid, false);
    assert.equal(validateItsEmail("0000000001@gmail.com").valid, false);
    assert.equal(validateDemoOtp("123456").valid, true);
    assert.equal(validateDemoOtp("000000").valid, false);
  });

  it("enforces internal return-path allowlist and strips disallowed queries", () => {
    assert.equal(sanitizeReturnPath("https://evil.example/x"), "/cari");
    assert.equal(sanitizeReturnPath("//evil.example"), "/cari");
    assert.equal(sanitizeReturnPath("/\\evil.example"), "/cari");
    assert.equal(sanitizeReturnPath("/admin"), "/cari");
    assert.equal(
      sanitizeReturnPath("/tutor/tutor-nadia?startChat=1&evil=2"),
      "/tutor/tutor-nadia"
    );
    assert.equal(
      sanitizeReturnPath("/cari?course=course-kalkulus-1&drop=1"),
      "/cari?course=course-kalkulus-1"
    );
  });

  it("parses valid WIB datetime-local values and rejects calendar rollover", () => {
    const valid = parseWibDateTimeLocal("2027-02-28T19:00");
    assert.notEqual(valid, null);
    assert.equal(toWibDateTimeLocalValue(valid!), "2027-02-28T19:00");
    assert.equal(parseWibDateTimeLocal("2027-02-31T19:00"), null);
    assert.match(formatIdr(45000), /45\.000/);

    const matrix = buildTutorScheduleMatrix({
      id: "tutor-nadia",
      slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
    });
    assert.equal(matrix.length, 4);
    assert.deepEqual(
      matrix.map((col) => col.day),
      ["Mon", "Wed", "Sat", "Fri"]
    );
    assert.equal(
      matrix[0]?.cells.find((c) => c.id === "Mon 18:30")?.available,
      true
    );
    assert.equal(
      matrix[2]?.cells.find((c) => c.id === "Sat 10:00")?.available,
      true
    );

    const baseMonMorning = parseWibDateTimeLocal("2027-03-01T09:00")!; // Mon 09:00 WIB
    const sameDayEvening = resolveNextSlotTimestampWib(
      "Mon 18:30",
      baseMonMorning
    );
    assert.equal(toWibDateTimeLocalValue(sameDayEvening!), "2027-03-01T18:30");
    assert.equal(formatWibClockTime(sameDayEvening!), "18:30");

    // Past time on same Monday rolls to next Monday (+7d)
    const nextWeekMon = resolveNextSlotTimestampWib(
      "Mon 08:00",
      baseMonMorning
    );
    assert.equal(toWibDateTimeLocalValue(nextWeekMon!), "2027-03-08T08:00");
    assert.equal(resolveNextSlotTimestampWib("Invalid 99:00"), null);
  });
});

describe("store validation & cross-tab sync", () => {
  it("rejects malformed nested array elements in DemoState", () => {
    assert.equal(
      isValidDemoState({
        version: 1,
        currentUserId: null,
        lastLearnerId: null,
        users: [null],
        courses: [],
        tutors: [{}],
        tutorApplications: [],
        conversations: [],
        messages: [],
        bookings: [],
        payments: [],
      }),
      false
    );
  });

  it("clears corrupt localStorage and merges external tab writes before mutating", () => {
    const map = new Map<string, string>();
    const fakeWindow = {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v);
        },
        removeItem: (k: string) => {
          map.delete(k);
        },
      },
      addEventListener: () => {},
    };
    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
    });

    try {
      map.set(DEMO_STORAGE_KEY, "{broken-json");
      hydrateDemoStore();
      assert.equal(map.has(DEMO_STORAGE_KEY), false);

      // Simulate Tab 1 message write
      const sent1 = chatService.sendMessage({
        conversationId: "conv-demo-seed-1",
        senderId: "user-learner-demo",
        content: "Pesan tab 1",
      });
      assert.equal(sent1.ok, true);

      // Simulate Tab 2 appending another message directly in localStorage
      const saved = JSON.parse(map.get(DEMO_STORAGE_KEY)!);
      saved.messages.push({
        id: "msg-tab-2",
        conversationId: "conv-demo-seed-1",
        senderId: "user-tutor-1",
        type: "text",
        content: "Balasan tab 2",
        createdAt: Date.now() + 1,
      });
      map.set(DEMO_STORAGE_KEY, JSON.stringify(saved));

      // Tab 1 writes again without having received a storage event yet
      const sent3 = chatService.sendMessage({
        conversationId: "conv-demo-seed-1",
        senderId: "user-learner-demo",
        content: "Pesan lanjutan tab 1",
      });
      assert.equal(sent3.ok, true);

      const allContents = chatService
        .listMessages("conv-demo-seed-1")
        .map((m) => m.content);
      assert.equal(allContents.includes("Balasan tab 2"), true);
      assert.equal(allContents.includes("Pesan lanjutan tab 1"), true);
    } finally {
      Reflect.deleteProperty(globalThis, "window");
    }
  });
});

describe("tutor search, offers, overlap, expired check, and checkout", () => {
  it("treats maxBudget=0 as zero Rupiah instead of disabling filter", () => {
    const zeroResults = tutorService.search({ maxBudget: 0 });
    assert.equal(zeroResults.length, 0);

    const integralResults = tutorService.search({
      query: "Integral",
      maxBudget: 45000,
    });
    assert.equal(integralResults.length > 0, true);
    assert.equal(
      integralResults.every(
        (r) => r.tutor.hourlyRate <= 45000 && typeof r.matchScore === "number"
      ),
      true
    );

    const onlineIds = tutorService
      .search({ location: "online" })
      .map((r) => r.tutor.id)
      .sort();
    assert.deepEqual(onlineIds, ["tutor-alya", "tutor-nadia", "tutor-salsa"]);

    const offlineIds = tutorService
      .search({ location: "offline" })
      .map((r) => r.tutor.id)
      .sort();
    assert.deepEqual(offlineIds, ["tutor-dimas", "tutor-nadia", "tutor-raka"]);

    const mondayIds = tutorService
      .search({ scheduleQuery: "Monday" })
      .map((r) => r.tutor.id)
      .sort();
    assert.deepEqual(mondayIds, ["tutor-nadia", "tutor-salsa"]);

    // English keyword search matches Indonesian stored courses & topics
    const derivativesIds = tutorService
      .search({ query: "Derivatives" })
      .map((r) => r.tutor.id);
    assert.equal(derivativesIds.includes("tutor-nadia"), true);
    assert.equal(
      tutorService.search({ query: "Basic Physics" }).length,
      3
    );
  });

  it("prevents self-verification on Jadi Tutor submission", () => {
    const beforeCount = tutorService.search({}).length;
    const sub = tutorService.submitApplication({
      userId: "user-learner-demo",
      name: "Bima Pratama",
      courseIds: ["course-kalkulus-1"],
      topics: ["Turunan"],
      bio: "Pernah dapat nilai A Kalkulus 1 semester lalu.",
      hourlyRateRaw: "40000",
      slots: ["Senin 18:30 WIB"],
    });
    assert.equal(sub.ok, true);
    if (sub.ok) assert.equal(sub.data.status, "pending");
    assert.equal(tutorService.search({}).length, beforeCount);
  });

  it("enforces role, expiry, overlap, double-accept, and full QRIS payment lifecycle", () => {
    const signup = authService.verifyDemoOtp({
      email: "0000000088@student.its.ac.id",
      otp: "123456",
      mode: "signup",
      name: "Rina Tester",
    });
    assert.equal(signup.ok, true);
    if (!signup.ok) return;

    const conv = chatService.getOrCreateConversation(
      signup.data.id,
      "tutor-nadia"
    );
    assert.equal(conv.ok, true);
    if (!conv.ok) return;
    assert.equal(conv.data.id.includes(signup.data.id), false);

    const slotStart = Date.now() + 2 * 60 * 60 * 1000;
    const offer1 = bookingService.createOffer({
      conversationId: conv.data.id,
      actorUserId: "user-tutor-1",
      courseId: "course-kalkulus-1",
      topic: "Integral Tentu",
      startAt: slotStart,
      priceRaw: 45000,
    });
    assert.equal(offer1.ok, true);
    if (!offer1.ok) return;

    // Tutor cannot accept own offer
    const tutorAccept = bookingService.acceptOffer({
      bookingId: offer1.data.id,
      actorUserId: "user-tutor-1",
    });
    assert.equal(tutorAccept.ok, false);

    // Learner accepts offer1
    const accepted = bookingService.acceptOffer({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
    });
    assert.equal(accepted.ok, true);

    // Duplicate acceptance blocked
    const dupAccept = bookingService.acceptOffer({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
    });
    assert.equal(dupAccept.ok, false);
    if (!dupAccept.ok) assert.equal(dupAccept.code, "ALREADY_ACCEPTED");

    // Overlapping offer for same tutor on another conversation is rejected on accept
    const overlapOffer = bookingService.createOffer({
      conversationId: "conv-demo-seed-1",
      actorUserId: "user-tutor-1",
      courseId: "course-kalkulus-1",
      topic: "Turunan",
      startAt: slotStart + 30 * 60 * 1000,
      priceRaw: 45000,
    });
    assert.equal(overlapOffer.ok, true);
    if (overlapOffer.ok) {
      const conflictAccept = bookingService.acceptOffer({
        bookingId: overlapOffer.data.id,
        actorUserId: "user-learner-demo",
      });
      assert.equal(conflictAccept.ok, false);
      if (!conflictAccept.ok) {
        assert.equal(conflictAccept.code, "SCHEDULE_CONFLICT");
      }
    }

    // Expired offer check: create an offer 50ms ahead, wait 70ms, then try accepting
    const shortOffer = bookingService.createOffer({
      conversationId: conv.data.id,
      actorUserId: "user-tutor-1",
      courseId: "course-kalkulus-1",
      topic: "Limit & Kekontinuan",
      startAt: Date.now() + 30,
      priceRaw: 45000,
    });
    assert.equal(shortOffer.ok, true);
    const waitUntil = Date.now() + 50;
    while (Date.now() < waitUntil) {
      // spin briefly for deterministic expiry check
    }
    if (shortOffer.ok) {
      const expiredAccept = bookingService.acceptOffer({
        bookingId: shortOffer.data.id,
        actorUserId: signup.data.id,
      });
      assert.equal(expiredAccept.ok, false);
      if (!expiredAccept.ok) assert.equal(expiredAccept.code, "OFFER_EXPIRED");
    }

    // Checkout lifecycle: start -> submit proof -> reject -> retry -> approve -> block repeat
    const started = paymentService.startPayment({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
    });
    assert.equal(started.ok, true);

    const submitted1 = paymentService.submitDemoProof({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
      proofName: "bukti-1.png",
    });
    assert.equal(submitted1.ok, true);
    if (submitted1.ok) assert.equal(submitted1.data.status, "pending_verification");

    const rejected = paymentService.simulateVerification({
      bookingId: offer1.data.id,
      decision: "reject",
    });
    assert.equal(rejected.ok, true);
    if (rejected.ok) assert.equal(rejected.data.status, "rejected");

    const submitted2 = paymentService.submitDemoProof({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
      proofName: "bukti-2.png",
    });
    assert.equal(submitted2.ok, true);

    const approved = paymentService.simulateVerification({
      bookingId: offer1.data.id,
      decision: "approve",
    });
    assert.equal(approved.ok, true);
    if (approved.ok) assert.equal(approved.data.status, "paid");

    const repeatStart = paymentService.startPayment({
      bookingId: offer1.data.id,
      actorUserId: signup.data.id,
    });
    assert.equal(repeatStart.ok, false);
    if (!repeatStart.ok) assert.equal(repeatStart.code, "ALREADY_PAID");

    // Direct session booking + auto-confirmed demo QRIS lifecycle
    const selfBook = bookingService.createDirectBooking({
      actorUserId: "user-tutor-1",
      tutorId: "tutor-nadia",
      courseId: "course-kalkulus-1",
      slotLabel: "Wed 19:00",
      sessionCount: 1,
    });
    assert.equal(selfBook.ok, false);
    if (!selfBook.ok) assert.equal(selfBook.code, "FORBIDDEN");

    const direct1 = bookingService.createDirectBooking({
      actorUserId: signup.data.id,
      tutorId: "tutor-nadia",
      courseId: "course-kalkulus-1",
      slotLabel: "Wed 19:00",
      sessionCount: 4,
    });
    assert.equal(direct1.ok, true);
    if (!direct1.ok) return;
    assert.equal(direct1.data.price, 180000);
    assert.equal(direct1.data.status, "accepted");

    // Re-clicking Pay Now for same unpaid slot reuses existing booking idempotently
    const direct1Retry = bookingService.createDirectBooking({
      actorUserId: signup.data.id,
      tutorId: "tutor-nadia",
      courseId: "course-kalkulus-1",
      slotLabel: "Wed 19:00",
      sessionCount: 4,
    });
    assert.equal(direct1Retry.ok, true);
    if (direct1Retry.ok) assert.equal(direct1Retry.data.id, direct1.data.id);

    // Another learner cannot double-book same slot
    const conflictDirect = bookingService.createDirectBooking({
      actorUserId: "user-learner-demo",
      tutorId: "tutor-nadia",
      courseId: "course-kalkulus-1",
      slotLabel: "Wed 19:00",
      sessionCount: 1,
    });
    assert.equal(conflictDirect.ok, false);
    if (!conflictDirect.ok) {
      assert.equal(conflictDirect.code, "SCHEDULE_CONFLICT");
    }

    // Wrong user cannot complete QRIS payment
    const intruderPay = paymentService.completeDemoQris({
      bookingId: direct1.data.id,
      actorUserId: "user-learner-demo",
    });
    assert.equal(intruderPay.ok, false);
    if (!intruderPay.ok) assert.equal(intruderPay.code, "FORBIDDEN");

    // Owner learner completes QRIS payment
    const autoPaid = paymentService.completeDemoQris({
      bookingId: direct1.data.id,
      actorUserId: signup.data.id,
    });
    assert.equal(autoPaid.ok, true);
    if (autoPaid.ok) assert.equal(autoPaid.data.status, "paid");
    assert.equal(bookingService.getById(direct1.data.id)?.status, "paid");
  });

  it("reproduces Bab 4.7 explainable rule-based matching benchmark scores (88.0, 81.1, 70.4)", () => {
    // Contoh perhitungan Bab 4.7 Brief:
    // Learner mencari Kalkulus 1, subtopik integral tentu, anggaran Rp35.000
    const tutorA = calculateBriefMatchScore({
      tutorId: "tutor-a",
      mastersSubtopic: true,
      subtopicLabel: "integral tentu",
      courseLabel: "Kalkulus 1",
      badge: "asdos",
      reviewCount: 10,
      ratingSum: 4.6 * 10,
      hourlyRate: 35000,
      maxBudget: 35000,
      matchingSlotsCount: 3,
    });
    assert.equal(tutorA.topicScore, 100);
    assert.equal(tutorA.trustScore, 93.5);
    assert.equal(tutorA.budgetScore, 50.0);
    assert.equal(tutorA.scheduleScore, 100);
    assert.equal(tutorA.totalScore, 88.0);

    const tutorB = calculateBriefMatchScore({
      tutorId: "tutor-b",
      mastersSubtopic: true,
      subtopicLabel: "integral tentu",
      courseLabel: "Kalkulus 1",
      badge: "grade",
      reviewCount: 0,
      ratingSum: 0,
      hourlyRate: 20000,
      maxBudget: 35000,
      matchingSlotsCount: 1,
    });
    assert.equal(tutorB.topicScore, 100);
    assert.equal(tutorB.trustScore, 75.0);
    assert.equal(tutorB.budgetScore, 92.9);
    assert.equal(tutorB.scheduleScore, 33.3);
    assert.equal(tutorB.totalScore, 81.1);

    const tutorC = calculateBriefMatchScore({
      tutorId: "tutor-c",
      mastersSubtopic: false,
      courseLabel: "Kalkulus 1",
      badge: "grade",
      reviewCount: 4,
      ratingSum: 4.2 * 4,
      hourlyRate: 25000,
      maxBudget: 35000,
      matchingSlotsCount: 2,
    });
    assert.equal(tutorC.topicScore, 60);
    assert.equal(tutorC.trustScore, 79.0);
    assert.equal(tutorC.budgetScore, 78.6);
    assert.equal(tutorC.scheduleScore, 66.7);
    assert.equal(tutorC.totalScore, 70.4);
  });

  it("enforces matching tie-breakers, searched course label, and negative budget guard", () => {
    assert.equal(tutorService.search({ maxBudget: -1 }).length, 0);

    const kalkulusResults = tutorService.search({
      courseId: "course-kalkulus-1",
    });
    const dimas = kalkulusResults.find((r) => r.tutor.id === "tutor-dimas");
    assert.ok(dimas);
    assert.equal(dimas.matchReasons.includes("Kalkulus 1 umum"), true);

    const tied = rankVerifiedTutors(
      [
        {
          id: "tutor-z",
          userId: "u-z",
          name: "Zeta",
          department: "Matematika",
          cohort: 2023,
          bio: "Bio tutor cukup panjang.",
          courseIds: ["course-kalkulus-1"],
          topics: ["Turunan"],
          hourlyRate: 40000,
          verified: true,
          badge: "grade",
          rating: 4.5,
          slots: ["Senin 19:00 WIB"],
        },
        {
          id: "tutor-a",
          userId: "u-a",
          name: "Alpha",
          department: "Matematika",
          cohort: 2023,
          bio: "Bio tutor cukup panjang.",
          courseIds: ["course-kalkulus-1"],
          topics: ["Turunan"],
          hourlyRate: 40000,
          verified: true,
          badge: "grade",
          rating: 4.5,
          slots: ["Senin 19:00 WIB"],
        },
      ],
      getDemoStateSnapshot().courses,
      { topic: "Turunan" }
    );
    assert.equal(tied[0]?.tutor.id, "tutor-a");
    assert.equal(tied[1]?.tutor.id, "tutor-z");
  });

  it("preserves optimistic active user across remote state sync and enforces participant/course guards", () => {
    const signup = authService.verifyDemoOtp({
      email: "5025231999@student.its.ac.id",
      otp: "123456",
      mode: "signup",
      name: "Rayyan Tester",
    });
    assert.equal(signup.ok, true);
    if (!signup.ok) return;

    // Simulate stale remote snapshot arriving before signup mutation settles
    const seedSnapshot = getDemoStateSnapshot();
    applyRemoteCollections({
      users: seedSnapshot.users.filter((u) => u.id !== signup.data.id),
      courses: seedSnapshot.courses,
      tutors: seedSnapshot.tutors,
      tutorApplications: seedSnapshot.tutorApplications,
      conversations: seedSnapshot.conversations,
      messages: seedSnapshot.messages,
      bookings: seedSnapshot.bookings,
      payments: seedSnapshot.payments,
    });
    assert.equal(authService.getSession()?.id, signup.data.id);

    // Reject unknown course in tutor application
    const badCourseApp = tutorService.submitApplication({
      userId: signup.data.id,
      name: "Rayyan Tester",
      courseIds: ["course-tidak-ada"],
      topics: ["Turunan"],
      bio: "Bio pengalaman mengajar minimal lima belas karakter.",
      hourlyRateRaw: 40000,
      slots: ["Senin 19:00 WIB"],
    });
    assert.equal(badCourseApp.ok, false);

    // Reject overly long topic (>120) or slot (>80) locally matching Convex bounds
    const longTopicApp = tutorService.submitApplication({
      userId: signup.data.id,
      name: "Rayyan Tester",
      courseIds: ["course-kalkulus-1"],
      topics: ["T".repeat(125)],
      bio: "Bio pengalaman mengajar minimal lima belas karakter.",
      hourlyRateRaw: 40000,
      slots: ["Senin 19:00 WIB"],
    });
    assert.equal(longTopicApp.ok, false);

    const longSlotApp = tutorService.submitApplication({
      userId: signup.data.id,
      name: "Rayyan Tester",
      courseIds: ["course-kalkulus-1"],
      topics: ["Turunan"],
      bio: "Bio pengalaman mengajar minimal lima belas karakter.",
      hourlyRateRaw: 40000,
      slots: ["S".repeat(85)],
    });
    assert.equal(longSlotApp.ok, false);

    // Reject > 100 char signup name locally matching Convex MAX_NAME_LENGTH
    const overlongSignup = authService.verifyDemoOtp({
      email: "5025231888@student.its.ac.id",
      otp: "123456",
      mode: "signup",
      name: "N".repeat(110),
    });
    assert.equal(overlongSignup.ok, false);

    // Reject markRead from non-participant or empty readerId
    assert.equal(chatService.markRead("conv-demo-seed-1", "").ok, false);
    assert.equal(
      chatService.markRead("conv-demo-seed-1", signup.data.id).ok,
      false
    );
  });

  it("hardens REST API routes against empty decision auto-approve, missing user_id, invalid params, and admin key bypass", async () => {
    const prevConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:1";

    try {
      // 1. Missing or unauthorized user_id on /api/conversations & /messages rejected (400 / 403)
      const convNoUser = await GET(
        new Request("http://localhost:3000/api/conversations"),
        { params: Promise.resolve({ slug: ["conversations"] }) }
      );
      assert.equal(convNoUser.status, 400);

      const msgNoUser = await GET(
        new Request(
          "http://localhost:3000/api/conversations/conv-demo-seed-1/messages"
        ),
        {
          params: Promise.resolve({
            slug: ["conversations", "conv-demo-seed-1", "messages"],
          }),
        }
      );
      assert.equal(msgNoUser.status, 400);

      const msgIntruder = await GET(
        new Request(
          "http://localhost:3000/api/conversations/conv-demo-seed-1/messages?user_id=user-tutor-2"
        ),
        {
          params: Promise.resolve({
            slug: ["conversations", "conv-demo-seed-1", "messages"],
          }),
        }
      );
      assert.equal(msgIntruder.status, 403);

      const msgOwner = await GET(
        new Request(
          "http://localhost:3000/api/conversations/conv-demo-seed-1/messages?user_id=user-learner-demo"
        ),
        {
          params: Promise.resolve({
            slug: ["conversations", "conv-demo-seed-1", "messages"],
          }),
        }
      );
      assert.equal(msgOwner.status, 200);

      // 2. Negative max_budget and invalid location rejected (400)
      const badBudget = await GET(
        new Request("http://localhost:3000/api/tutors?max_budget=-5000"),
        { params: Promise.resolve({ slug: ["tutors"] }) }
      );
      assert.equal(badBudget.status, 400);

      const badLocation = await GET(
        new Request("http://localhost:3000/api/tutors?location=mars"),
        { params: Promise.resolve({ slug: ["tutors"] }) }
      );
      assert.equal(badLocation.status, 400);

      const onlineApi = await GET(
        new Request("http://localhost:3000/api/tutors?location=online"),
        { params: Promise.resolve({ slug: ["tutors"] }) }
      );
      assert.equal(onlineApi.status, 200);
      const onlineJson = (await onlineApi.json()) as { data: unknown[] };
      assert.equal(onlineJson.data.length, 3);

      // 3. Empty body on payment/status rejected (400), never auto-approved
      const emptyDecision = await PATCH(
        new Request(
          "http://localhost:3000/api/bookings/bk-demo-1/payment/status",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        ),
        {
          params: Promise.resolve({
            slug: ["bookings", "bk-demo-1", "payment", "status"],
          }),
        }
      );
      assert.equal(emptyDecision.status, 400);

      // 4. Malformed JSON rejected (400)
      const brokenJson = await POST(
        new Request("http://localhost:3000/api/auth/request-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{broken",
        }),
        { params: Promise.resolve({ slug: ["auth", "request-otp"] }) }
      );
      assert.equal(brokenJson.status, 400);

      // 5. Fallback /api/admin/metrics returns all 13 schema fields
      const metricsRes = await GET(
        new Request("http://localhost:3000/api/admin/metrics"),
        { params: Promise.resolve({ slug: ["admin", "metrics"] }) }
      );
      assert.equal(metricsRes.status, 200);
      const metricsJson = (await metricsRes.json()) as {
        data: Record<string, unknown>;
      };
      assert.equal(typeof metricsJson.data.acceptanceRatePercent, "number");
      assert.equal(typeof metricsJson.data.paymentCompletionRatePercent, "number");
      assert.equal(typeof metricsJson.data.averageTutorRating, "number");
      assert.equal(typeof metricsJson.data.totalRevenueIdr, "number");

      // 6. KOLEARA_ADMIN_KEY enforcement on admin & reset endpoints
      process.env.KOLEARA_ADMIN_KEY = "rahasia-admin-koleara";
      try {
        const deniedUsers = await GET(
          new Request("http://localhost:3000/api/users"),
          { params: Promise.resolve({ slug: ["users"] }) }
        );
        assert.equal(deniedUsers.status, 401);

        const deniedMetrics = await GET(
          new Request("http://localhost:3000/api/admin/metrics"),
          { params: Promise.resolve({ slug: ["admin", "metrics"] }) }
        );
        assert.equal(deniedMetrics.status, 401);

        const deniedDelete = await DELETE(
          new Request(
            "http://localhost:3000/api/admin/tutor-applications/app-1",
            { method: "DELETE" }
          ),
          {
            params: Promise.resolve({
              slug: ["admin", "tutor-applications", "app-1"],
            }),
          }
        );
        assert.equal(deniedDelete.status, 401);

        const deniedPaymentApprove = await PATCH(
          new Request(
            "http://localhost:3000/api/bookings/bk-demo-1/payment/status",
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ decision: "approve" }),
            }
          ),
          {
            params: Promise.resolve({
              slug: ["bookings", "bk-demo-1", "payment", "status"],
            }),
          }
        );
        assert.equal(deniedPaymentApprove.status, 401);

        const allowedMetrics = await GET(
          new Request("http://localhost:3000/api/admin/metrics", {
            headers: { "x-admin-key": "rahasia-admin-koleara" },
          }),
          { params: Promise.resolve({ slug: ["admin", "metrics"] }) }
        );
        assert.equal(allowedMetrics.status, 200);
      } finally {
        delete process.env.KOLEARA_ADMIN_KEY;
      }
    } finally {
      if (prevConvexUrl === undefined) {
        delete process.env.NEXT_PUBLIC_CONVEX_URL;
      } else {
        process.env.NEXT_PUBLIC_CONVEX_URL = prevConvexUrl;
      }
    }
  });
});

describe("Brief v2 backend logic: NRP cohort, Static QRIS, Midtrans SHA-512, refund 12h, and pilot metrics", () => {
  it("extracts ITS NRP and cohort year from digits 5 & 6 and normalizes WhatsApp numbers", () => {
    assert.equal(extractNrpFromItsEmail("5025261001@student.its.ac.id"), "5025261001");
    assert.equal(extractCohortYearFromNrp("5025261001"), 2026);
    assert.equal(extractCohortYearFromNrp("5025231042"), 2023);
    assert.equal(extractCohortYearFromNrp("0000000001"), undefined);

    const wa1 = validateWhatsappNumber("0812-3456-7890");
    assert.equal(wa1.valid, true);
    assert.equal(wa1.normalized, "6281234567890");

    const wa2 = validateWhatsappNumber("+62 813 9999 8888");
    assert.equal(wa2.valid, true);
    assert.equal(wa2.normalized, "6281399998888");

    assert.equal(validateWhatsappNumber("123").valid, false);
  });

  it("verifies Midtrans SHA-512 signatures and rejects tampered payloads", async () => {
    const serverKey = "SB-Mid-server-TESTKEY123";
    const orderId = "KLR-bk-001";
    const statusCode = "200";
    const grossAmount = "45000.00";
    const validSig = await sha512Hex(`${orderId}${statusCode}${grossAmount}${serverKey}`);

    assert.equal(
      await verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        serverKey,
        signatureKey: validSig,
      }),
      true
    );
    assert.equal(
      await verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount: "10000.00",
        serverKey,
        signatureKey: validSig,
      }),
      false
    );

    const prevServerKey = process.env.MIDTRANS_SERVER_KEY;
    process.env.MIDTRANS_SERVER_KEY = serverKey;
    try {
      const tamperedRes = await MIDTRANS_WEBHOOK_POST(
        new Request("http://localhost:3000/api/midtrans/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: orderId,
            status_code: statusCode,
            gross_amount: grossAmount,
            signature_key: "deadbeef",
          }),
        })
      );
      assert.equal(tamperedRes.status, 401);
    } finally {
      if (prevServerKey === undefined) delete process.env.MIDTRANS_SERVER_KEY;
      else process.env.MIDTRANS_SERVER_KEY = prevServerKey;
    }
  });

  it("enforces Bab 4.5 12-hour cancellation and refund policy", () => {
    const now = Date.parse("2026-11-28T12:00:00+07:00");
    const in15Hours = now + 15 * 60 * 60 * 1000;
    const in4Hours = now + 4 * 60 * 60 * 1000;

    const learnerEarly = evaluateCancellationRefund({
      cancelledByRole: "learner",
      wasPaid: true,
      startAt: in15Hours,
      nowMs: now,
    });
    assert.equal(learnerEarly.refundEligible, true);
    assert.equal(learnerEarly.nextEscrowStatus, "refunded");

    const learnerLate = evaluateCancellationRefund({
      cancelledByRole: "learner",
      wasPaid: true,
      startAt: in4Hours,
      nowMs: now,
    });
    assert.equal(learnerLate.refundEligible, false);
    assert.equal(learnerLate.nextEscrowStatus, "ready_for_payout");

    const tutorCancel = evaluateCancellationRefund({
      cancelledByRole: "tutor",
      wasPaid: true,
      startAt: in4Hours,
      nowMs: now,
    });
    assert.equal(tutorCancel.refundEligible, true);
    assert.equal(tutorCancel.nextEscrowStatus, "refunded");
  });

  it("filters tutors by language, supports Fisika Mekanika alias, and computes Bab 6.1 pilot metrics", () => {
    const courses = [
      {
        id: "course-fisika-dasar-1",
        code: "KF234101",
        name: "Fisika Dasar 1",
        description: "Mekanika klasik",
        aliases: ["Fisika Mekanika"],
        topics: ["Kinematika 1D & 2D"],
      },
    ];
    const tutors = [
      {
        id: "tutor-en",
        userId: "u-en",
        name: "Bilingual Tutor",
        department: "Fisika",
        cohort: 2023,
        bio: "Bilingual tutor for IUP students",
        courseIds: ["course-fisika-dasar-1"],
        topics: ["Kinematika 1D & 2D"],
        hourlyRate: 35000,
        verified: true,
        badge: "asdos" as const,
        reviewCount: 4,
        clarityRatingSum: 19,
        languages: ["id" as const, "en" as const],
        slots: ["Senin 19:00 WIB"],
      },
      {
        id: "tutor-id",
        userId: "u-id",
        name: "Indonesian Tutor",
        department: "Fisika",
        cohort: 2023,
        bio: "Tutor fisika dasar",
        courseIds: ["course-fisika-dasar-1"],
        topics: ["Kinematika 1D & 2D"],
        hourlyRate: 30000,
        verified: true,
        badge: "grade" as const,
        languages: ["id" as const],
        slots: ["Senin 19:00 WIB"],
      },
    ];

    const enMatches = rankVerifiedTutors(tutors, courses, {
      query: "Fisika Mekanika",
      language: "en",
    });
    assert.equal(enMatches.length, 1);
    assert.equal(enMatches[0]?.tutor.id, "tutor-en");

    const base = Date.parse("2026-11-28T10:00:00+07:00");
    const metrics = computePilotMetrics({
      users: [
        { id: "u1", role: "learner", createdAt: base },
        { id: "u2", role: "learner", createdAt: base },
        { id: "t1", role: "tutor", createdAt: base },
      ],
      verifiedTutors: [{ rating: 4.8 }],
      pendingApplicationsCount: 1,
      conversationsCount: 2,
      messagesCount: 8,
      bookings: [
        {
          status: "completed",
          price: 35000,
          learnerId: "u1",
          createdAt: base + 10 * 60_000,
          acceptedAt: base + 30 * 60_000,
          escrowStatus: "paid_out",
        },
        {
          status: "paid",
          price: 40000,
          learnerId: "u2",
          createdAt: base + 20 * 60_000,
          acceptedAt: base + 60 * 60_000,
          escrowStatus: "held",
        },
      ],
      reviews: [
        { clarityRating: 5, pacingRating: 4 },
        { clarityRating: 4, pacingRating: 5 },
      ],
    });

    assert.equal(metrics.completedBookings, 1);
    assert.equal(metrics.sessionCompletionRatePercent, 50);
    assert.equal(metrics.medianTimeToAcceptMinutes, 30);
    assert.equal(metrics.medianTimeToFirstRequestMinutes, 15);
    assert.equal(metrics.averageClarityRating, 4.5);
    assert.equal(metrics.averagePacingRating, 4.5);
    assert.equal(metrics.totalEscrowHeldIdr, 40000);
    assert.equal(metrics.totalPaidOutIdr, 35000);
  });

  it("exposes static QRIS config via GET /api/payment-config", async () => {
    const prevConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:1";
    try {
      const res = await GET(
        new Request("http://localhost:3000/api/payment-config"),
        { params: Promise.resolve({ slug: ["payment-config"] }) }
      );
      assert.equal(res.status, 200);
      const json = (await res.json()) as { data: { mode: string; qrisImageUrl: string } };
      assert.equal(json.data.mode, "static_qris");
      assert.equal(typeof json.data.qrisImageUrl, "string");
    } finally {
      if (prevConvexUrl === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL;
      else process.env.NEXT_PUBLIC_CONVEX_URL = prevConvexUrl;
    }
  });
});
