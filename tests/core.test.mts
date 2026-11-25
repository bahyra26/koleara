import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  formatIdr,
  parseWibDateTimeLocal,
  toWibDateTimeLocalValue,
} from "@/lib/formatters";
import { calculateBriefMatchScore } from "@/lib/matching";
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
import {
  sanitizeReturnPath,
  validateDemoOtp,
  validateItsEmail,
} from "@/lib/validators";

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
});
