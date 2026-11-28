"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { useAuth } from "@/features/auth/useAuth";
import { useCourses } from "@/features/tutors/useTutors";
import { formatIdr, formatWibDateTime } from "@/lib/formatters";

type DashboardTab = "requests" | "schedule" | "earnings" | "slots";

type EditableSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const DAY_LABELS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export default function TutorDashboardPage() {
  const { user, sessionToken, hydrated } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("requests");

  const courses = useCourses();
  const earnings = useQuery(
    api.tutors.getTutorEarningsSummary,
    user && sessionToken ? { sessionToken } : "skip"
  );
  const myTutorBookings = useQuery(
    api.bookings.listMySessions,
    user && sessionToken ? { sessionToken, roleView: "tutor" } : "skip"
  );
  const myPayoutAccount = useQuery(
    api.auth.getMyPayoutAccount,
    user && sessionToken ? { sessionToken } : "skip"
  );
  const myApplications = useQuery(
    api.tutors.listApplications,
    user && sessionToken ? { userId: user.id, sessionToken } : "skip"
  );
  const myPayouts = useQuery(
    api.admin.listPayouts,
    earnings?.tutorId && sessionToken
      ? { tutorId: earnings.tutorId, sessionToken }
      : "skip"
  );
  const savedSlots = useQuery(
    api.tutors.getTutorAvailabilitySlots,
    earnings?.tutorId ? { tutorId: earnings.tutorId } : "skip"
  );

  const acceptSession = useMutation(api.bookings.acceptSession);
  const declineSession = useMutation(api.bookings.declineSession);
  const updateMeetingLink = useMutation(api.bookings.updateMeetingLink);
  const markTutorDone = useMutation(api.bookings.markTutorDone);
  const cancelSession = useMutation(api.bookings.cancelSession);
  const upsertPayoutAccount = useMutation(api.auth.upsertMyPayoutAccount);
  const upsertSlots = useMutation(api.tutors.upsertTutorAvailabilitySlots);

  const [meetingDrafts, setMeetingDrafts] = useState<Record<string, string>>({});
  const [declineDrafts, setDeclineDrafts] = useState<Record<string, string>>({});

  const [bankOrWalletOverride, setBankOrWallet] = useState<string | null>(null);
  const [accountNameOverride, setAccountName] = useState<string | null>(null);
  const [accountNumberOverride, setAccountNumber] = useState<string | null>(
    null
  );

  const [slotsOverride, setSlotsOverride] = useState<EditableSlot[] | null>(
    null
  );

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "neutral" | "emphasis";
    text: string;
  } | null>(null);

  const bankOrWallet =
    bankOrWalletOverride ?? myPayoutAccount?.bankOrWallet ?? "";
  const accountName =
    accountNameOverride ?? myPayoutAccount?.accountName ?? "";
  const accountNumber =
    accountNumberOverride ?? myPayoutAccount?.accountNumber ?? "";

  const slotsDraft: EditableSlot[] = useMemo(() => {
    if (slotsOverride !== null) return slotsOverride;
    if (savedSlots && savedSlots.length > 0) {
      return savedSlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    }
    return [
      { dayOfWeek: 1, startTime: "19:00", endTime: "20:00" },
      { dayOfWeek: 3, startTime: "19:00", endTime: "20:00" },
    ];
  }, [slotsOverride, savedSlots]);

  const setSlotsDraft = (
    updater: (prev: EditableSlot[]) => EditableSlot[]
  ) => {
    setSlotsOverride((prev) => updater(prev ?? slotsDraft));
  };

  const courseMap = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses]
  );

  const incomingRequests = useMemo(
    () => (myTutorBookings ?? []).filter((b) => b.status === "requested"),
    [myTutorBookings]
  );

  const activeAndPastSessions = useMemo(
    () => (myTutorBookings ?? []).filter((b) => b.status !== "requested"),
    [myTutorBookings]
  );

  if (!hydrated) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memuat Dashboard Tutor...
      </div>
    );
  }

  if (!user || !sessionToken) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 text-center">
          <h1 className="text-xl font-semibold text-[#263238]">
            Login Sebagai Tutor ITS
          </h1>
          <p className="text-sm text-[#5B686D]">
            Masuk dengan email ITS Anda untuk mengelola permintaan sesi, slot
            mingguan, dan pencairan honor.
          </p>
          <Link
            href="/login?next=%2Fdashboard-tutor"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#285B7B] px-6 text-sm font-semibold text-white"
          >
            Login Email ITS
          </Link>
        </Card>
      </div>
    );
  }

  if (earnings === undefined) {
    return (
      <div className="py-12 text-center text-sm text-[#5B686D]">
        Memeriksa status profil tutor Anda...
      </div>
    );
  }

  if (earnings === null) {
    const latestApp = myApplications?.[0];
    return (
      <div className="mx-auto max-w-xl py-10">
        <Card className="space-y-4 rounded-[26px] border-[#CBD6DE] p-6 sm:p-8">
          <Badge variant="outline">Belum Terdaftar Sebagai Tutor</Badge>
          <h1 className="text-2xl font-semibold text-[#263238]">
            Dashboard Tutor Khusus Tutor Terverifikasi
          </h1>
          <p className="text-sm text-[#5B686D]">
            {latestApp?.status === "pending"
              ? "Pengajuan tutor Anda sedang ditinjau oleh admin KOLEARA. Anda akan mendapat notifikasi email setelah disetujui."
              : latestApp?.status === "rejected"
                ? `Pengajuan terakhir ditolak: ${latestApp.rejectionReason ?? "Belum memenuhi syarat"}. Anda dapat mengajukan ulang.`
                : "Daftar sebagai tutor sebaya ITS dengan mengunggah bukti nilai A/AB atau surat Asdos untuk mulai mengajar."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/jadi-tutor"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#285B7B] px-5 text-sm font-semibold text-white hover:bg-[#1E4761]"
            >
              {latestApp ? "Lihat Status Pendaftaran" : "Daftar Jadi Tutor"}
            </Link>
            <Link
              href="/sesi"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#CBD6DE] px-5 text-sm font-medium text-[#263238]"
            >
              Lihat Sesi Learner
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleAccept = async (bookingId: string) => {
    setBusyKey(`accept-${bookingId}`);
    setFeedback(null);
    const res = await acceptSession({
      bookingId,
      sessionToken,
      meetingLink: meetingDrafts[bookingId]?.trim() || undefined,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text: "Sesi diterima! Learner telah dinotifikasi untuk menyelesaikan pembayaran.",
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleDecline = async (bookingId: string) => {
    setBusyKey(`decline-${bookingId}`);
    setFeedback(null);
    const res = await declineSession({
      bookingId,
      sessionToken,
      declineReason: declineDrafts[bookingId]?.trim() || undefined,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? { tone: "neutral", text: "Permintaan sesi telah ditolak." }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleUpdateLink = async (bookingId: string) => {
    const link = meetingDrafts[bookingId]?.trim();
    if (!link) return;
    setBusyKey(`link-${bookingId}`);
    setFeedback(null);
    const res = await updateMeetingLink({
      bookingId,
      sessionToken,
      meetingLink: link,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? { tone: "neutral", text: "Link meeting / lokasi berhasil disimpan." }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleMarkDone = async (bookingId: string) => {
    setBusyKey(`done-${bookingId}`);
    setFeedback(null);
    const res = await markTutorDone({ bookingId, sessionToken });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text: "Sesi ditandai selesai. Timer auto-complete 24 jam aktif.",
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleTutorCancel = async (bookingId: string) => {
    setBusyKey(`cancel-${bookingId}`);
    setFeedback(null);
    const res = await cancelSession({
      bookingId,
      sessionToken,
      reason: "Dibatalkan oleh tutor melalui Dashboard Tutor.",
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? { tone: "neutral", text: `Sesi dibatalkan. ${res.data.refundReason}` }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleSavePayoutAccount = async (e: FormEvent) => {
    e.preventDefault();
    setBusyKey("payout-account");
    setFeedback(null);
    const res = await upsertPayoutAccount({
      sessionToken,
      bankOrWallet,
      accountName,
      accountNumber,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? { tone: "neutral", text: "Rekening pencairan honor berhasil diperbarui." }
        : { tone: "emphasis", text: res.error }
    );
  };

  const handleSaveSlots = async (e: FormEvent) => {
    e.preventDefault();
    setBusyKey("slots");
    setFeedback(null);
    const res = await upsertSlots({
      sessionToken,
      slots: slotsDraft,
    });
    setBusyKey(null);
    setFeedback(
      res.ok
        ? {
            tone: "neutral",
            text: `${res.data.count} slot jadwal mingguan berhasil disimpan.`,
          }
        : { tone: "emphasis", text: res.error }
    );
  };

  return (
    <section className="space-y-6 pb-12 pt-2">
      {/* Header Banner */}
      <div className="rounded-[28px] border border-[#CBD6DE] bg-[#215273] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B6D4E7]">
              Dashboard Tutor Terverifikasi
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              Halo, {user.name}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              Kelola permintaan sesi, jadwal mengajar, dan rekening pencairan
              honor KOLEARA Anda.
            </p>
          </div>
          <Link
            href={`/tutor/${earnings.tutorId}`}
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-[#215273] hover:bg-[#EAF2F7]"
          >
            Lihat Profil Publik ↗
          </Link>
        </div>

        {/* Summary KPI Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Permintaan Masuk</p>
            <p className="mt-1 text-2xl font-bold">{incomingRequests.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Escrow Ditahan</p>
            <p className="mt-1 text-xl font-bold">
              {formatIdr(earnings.heldIdr)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Siap Dicairkan</p>
            <p className="mt-1 text-xl font-bold text-[#A7F3D0]">
              {formatIdr(earnings.readyForPayoutIdr)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs text-white/75">Total Sudah Cair</p>
            <p className="mt-1 text-xl font-bold">
              {formatIdr(earnings.paidOutIdr)}
            </p>
          </div>
        </div>
      </div>

      {feedback ? (
        <Notice tone={feedback.tone} role="status">
          {feedback.text}
        </Notice>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist">
        {(
          [
            {
              id: "requests",
              label: `Permintaan Masuk (${incomingRequests.length})`,
            },
            {
              id: "schedule",
              label: `Jadwal & Sesi Aktif (${activeAndPastSessions.length})`,
            },
            { id: "earnings", label: "Pendapatan & Rekening" },
            { id: "slots", label: "Slot Mingguan" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "border-[#285B7B] bg-[#285B7B] text-white"
                : "border-[#CBD6DE] bg-white text-[#5B686D] hover:bg-[#F3F7FA]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Incoming Requests */}
      {activeTab === "requests" ? (
        incomingRequests.length === 0 ? (
          <Card className="rounded-[24px] border-[#CBD6DE] py-12 text-center">
            <p className="font-semibold text-[#263238]">
              Tidak ada permintaan sesi baru saat ini
            </p>
            <p className="mt-1 text-sm text-[#5B686D]">
              Pastikan slot mingguan Anda aktif agar mahasiswa mudah menemukan
              jadwal Anda.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {incomingRequests.map((booking) => {
              const course = courseMap.get(booking.courseId);
              return (
                <Card
                  key={booking.id}
                  className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline">Menunggu Persetujuan</Badge>
                      <h2 className="mt-1.5 text-lg font-semibold text-[#263238]">
                        {course ? `${course.name} — ` : ""}
                        {booking.topic}
                      </h2>
                      <p className="text-sm text-[#5B686D]">
                        {formatWibDateTime(booking.startAt)} •{" "}
                        {booking.sessionCount ?? 1} sesi •{" "}
                        <strong>{formatIdr(booking.price)}</strong>
                      </p>
                    </div>
                    <Link
                      href={`/sesi/${booking.id}`}
                      className="text-xs font-semibold text-[#3979A5] hover:underline"
                    >
                      Lihat Detail Lengkap →
                    </Link>
                  </div>

                  <div className="rounded-xl bg-[#F8FAFB] p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5B686D]">
                      Pre-Session Brief ({booking.difficultyTier ?? "basic"})
                    </p>
                    <p className="mt-1 text-[#263238]">
                      {booking.diagnosticNotes ??
                        booking.brief ??
                        "Tidak ada catatan."}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      id={`link-${booking.id}`}
                      label="Link Meeting / Lokasi Temu (Opsional saat terima)"
                      placeholder="https://meet.google.com/... atau Perpustakaan ITS"
                      value={meetingDrafts[booking.id] ?? ""}
                      onChange={(e) =>
                        setMeetingDrafts((prev) => ({
                          ...prev,
                          [booking.id]: e.target.value,
                        }))
                      }
                    />
                    <Input
                      id={`decline-${booking.id}`}
                      label="Alasan jika Menolak (Opsional)"
                      placeholder="Contoh: Jadwal bentrok kuliah"
                      value={declineDrafts[booking.id] ?? ""}
                      onChange={(e) =>
                        setDeclineDrafts((prev) => ({
                          ...prev,
                          [booking.id]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => handleAccept(booking.id)}
                      disabled={busyKey !== null}
                      className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                    >
                      {busyKey === `accept-${booking.id}`
                        ? "Memproses..."
                        : "Terima & Kunci Slot"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDecline(booking.id)}
                      disabled={busyKey !== null}
                    >
                      {busyKey === `decline-${booking.id}`
                        ? "Menolak..."
                        : "Tolak Permintaan"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {/* TAB 2: Active & Past Schedule */}
      {activeTab === "schedule" ? (
        activeAndPastSessions.length === 0 ? (
          <Card className="rounded-[24px] border-[#CBD6DE] py-12 text-center">
            <p className="font-semibold text-[#263238]">
              Belum ada sesi terjadwal atau selesai
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeAndPastSessions.map((booking) => {
              const course = courseMap.get(booking.courseId);
              const linkVal =
                meetingDrafts[booking.id] ?? booking.meetingLink ?? "";
              return (
                <Card
                  key={booking.id}
                  className="space-y-4 rounded-[24px] border-[#CBD6DE] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="solid">
                          {booking.status.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                        <Badge variant="muted">
                          Escrow: {booking.escrowStatus ?? "none"}
                        </Badge>
                      </div>
                      <h2 className="mt-1.5 text-base font-semibold text-[#263238]">
                        {course ? `${course.name} — ` : ""}
                        {booking.topic}
                      </h2>
                      <p className="text-sm text-[#5B686D]">
                        {formatWibDateTime(booking.startAt)} •{" "}
                        {formatIdr(booking.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      <Link
                        href={`/sesi/${booking.id}`}
                        className="text-[#3979A5] hover:underline"
                      >
                        Pelacak Sesi
                      </Link>
                      {booking.conversationId ? (
                        <Link
                          href={`/chat/${booking.conversationId}`}
                          className="text-[#285B7B] hover:underline"
                        >
                          Chat
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {booking.status === "accepted" || booking.status === "paid" ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Input
                          id={`sched-link-${booking.id}`}
                          label="Link Meeting / Lokasi ITS"
                          placeholder="https://meet.google.com/..."
                          value={linkVal}
                          onChange={(e) =>
                            setMeetingDrafts((prev) => ({
                              ...prev,
                              [booking.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateLink(booking.id)}
                        disabled={busyKey !== null}
                      >
                        Simpan Link
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {booking.status === "paid" ? (
                      <Button
                        size="sm"
                        onClick={() => handleMarkDone(booking.id)}
                        disabled={busyKey !== null}
                        className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
                      >
                        {busyKey === `done-${booking.id}`
                          ? "Memproses..."
                          : "Tandai Sesi Selesai"}
                      </Button>
                    ) : null}
                    {booking.status === "accepted" || booking.status === "paid" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTutorCancel(booking.id)}
                        disabled={busyKey !== null}
                      >
                        Batalkan Sesi
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : null}

      {/* TAB 3: Earnings & Payout Account */}
      {activeTab === "earnings" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
            <div>
              <h2 className="text-lg font-semibold text-[#263238]">
                Rekening Pencairan Honor
              </h2>
              <p className="text-xs text-[#5B686D]">
                Admin KOLEARA mentransfer honor batch mingguan (100% tarif sesi
                pada fase pilot) ke rekening ini.
              </p>
            </div>
            <form onSubmit={handleSavePayoutAccount} className="space-y-4">
              <Input
                id="payout-bank"
                label="Bank / E-Wallet"
                placeholder="Contoh: BCA, Mandiri, BNI, GoPay, OVO, Dana"
                value={bankOrWallet}
                onChange={(e) => setBankOrWallet(e.target.value)}
                required
              />
              <Input
                id="payout-name"
                label="Nama Pemilik Rekening"
                placeholder="Sesuai buku tabungan / akun e-wallet"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
              <Input
                id="payout-number"
                label="Nomor Rekening / Nomor HP E-Wallet"
                placeholder="Contoh: 081234567890"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                required
              />
              <Button
                type="submit"
                disabled={busyKey === "payout-account"}
                className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
              >
                {busyKey === "payout-account"
                  ? "Menyimpan..."
                  : "Simpan Rekening Pencairan"}
              </Button>
            </form>
          </Card>

          <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
            <h2 className="text-lg font-semibold text-[#263238]">
              Riwayat Pencairan Honor
            </h2>
            {!myPayouts || myPayouts.length === 0 ? (
              <p className="text-sm text-[#5B686D]">
                Belum ada pencairan honor yang diproses. Sesi yang telah
                dikonfirmasi selesai otomatis masuk ke saldo Siap Dicairkan.
              </p>
            ) : (
              <div className="space-y-3">
                {myPayouts.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[#E3E7E9] bg-[#F8FAFB] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[#263238]">
                        {formatIdr(p.amount)}
                      </p>
                      <Badge variant="solid">Cair</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#5B686D]">
                      {p.bookingIds.length} sesi •{" "}
                      {p.paidOutAt ? formatWibDateTime(p.paidOutAt) : "-"}
                    </p>
                    {p.proofUrl ? (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-[#3979A5] hover:underline"
                      >
                        Lihat Bukti Transfer Admin ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* TAB 4: Weekly Availability Slots */}
      {activeTab === "slots" ? (
        <Card className="space-y-4 rounded-[24px] border-[#CBD6DE] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#263238]">
                Atur Slot Ketersediaan Mingguan (WIB)
              </h2>
              <p className="text-sm text-[#5B686D]">
                Slot yang Anda simpan akan langsung tampil di halaman profil
                tutor dan katalog pencarian.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSlotsDraft((prev) => [
                  ...prev,
                  { dayOfWeek: 2, startTime: "19:00", endTime: "20:00" },
                ])
              }
            >
              + Tambah Slot
            </Button>
          </div>

          <form onSubmit={handleSaveSlots} className="space-y-3">
            {slotsDraft.map((slot, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-3 rounded-xl border border-[#E3E7E9] bg-[#F8FAFB] p-3 sm:grid-cols-4 sm:items-end"
              >
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#5B686D]">
                    Hari
                  </label>
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => {
                      const nextDow = Number.parseInt(e.target.value, 10);
                      setSlotsDraft((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, dayOfWeek: nextDow } : item
                        )
                      );
                    }}
                    className="min-h-10 w-full rounded-lg border border-[#CBD6DE] bg-white px-3 text-sm text-[#263238]"
                  >
                    {DAY_LABELS.map((label, dow) => (
                      <option key={label} value={dow}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  id={`slot-start-${index}`}
                  label="Mulai (WIB)"
                  type="time"
                  value={slot.startTime}
                  onChange={(e) =>
                    setSlotsDraft((prev) =>
                      prev.map((item, idx) =>
                        idx === index
                          ? { ...item, startTime: e.target.value }
                          : item
                      )
                    )
                  }
                  required
                />

                <Input
                  id={`slot-end-${index}`}
                  label="Selesai (WIB)"
                  type="time"
                  value={slot.endTime}
                  onChange={(e) =>
                    setSlotsDraft((prev) =>
                      prev.map((item, idx) =>
                        idx === index
                          ? { ...item, endTime: e.target.value }
                          : item
                      )
                    )
                  }
                  required
                />

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={slotsDraft.length <= 1}
                  onClick={() =>
                    setSlotsDraft((prev) =>
                      prev.filter((_, idx) => idx !== index)
                    )
                  }
                >
                  Hapus
                </Button>
              </div>
            ))}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={busyKey === "slots"}
                className="bg-[#285B7B] border-[#285B7B] hover:bg-[#1E4761]"
              >
                {busyKey === "slots"
                  ? "Menyimpan Slot..."
                  : "Simpan Jadwal Mingguan"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
