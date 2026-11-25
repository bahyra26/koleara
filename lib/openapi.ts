export type EndpointKind = "query" | "mutation";

export type ApiEndpointDoc = {
  id: string;
  tag:
    | "Auth (Email ITS & OTP)"
    | "Tutors & Matching Engine"
    | "Chat Real-Time"
    | "Bookings & Anti-Bentrok"
    | "Payments (QRIS Demo)"
    | "Admin & Pilot Metrics"
    | "Seed & App State";
  module: string;
  fn: string;
  kind: EndpointKind;
  summary: string;
  description: string;
  reactHookSnippet: string;
  defaultArgs: Record<string, unknown>;
  argsDescription: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  exampleResponse: unknown;
};

export const API_ENDPOINTS_CATALOG: ApiEndpointDoc[] = [
  // 1. AUTH
  {
    id: "auth-listUsers",
    tag: "Auth (Email ITS & OTP)",
    module: "auth",
    fn: "listUsers",
    kind: "query",
    summary: "Ambil daftar seluruh akun pengguna (Mahasiswa & Tutor)",
    description:
      "Mengambil seluruh akun pengguna dari tabel `users` di Convex.",
    reactHookSnippet: `const users = useQuery(api.auth.listUsers, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: [
      {
        id: "user-learner-demo",
        email: "0000000001@student.its.ac.id",
        name: "Bima Pratama",
        role: "learner",
      },
    ],
  },
  {
    id: "auth-getUserById",
    tag: "Auth (Email ITS & OTP)",
    module: "auth",
    fn: "getUserById",
    kind: "query",
    summary: "Ambil detail satu pengguna berdasarkan ID",
    description:
      "Mencari pengguna di tabel `users` menggunakan index `by_appId`.",
    reactHookSnippet: `const user = useQuery(api.auth.getUserById, { userId: "user-learner-demo" });`,
    defaultArgs: { userId: "user-learner-demo" },
    argsDescription: [
      {
        name: "userId",
        type: "string",
        required: true,
        description: "ID aplikasi pengguna (contoh: user-learner-demo)",
      },
    ],
    exampleResponse: {
      id: "user-learner-demo",
      email: "0000000001@student.its.ac.id",
      name: "Bima Pratama",
      role: "learner",
    },
  },
  {
    id: "auth-requestDemoOtp",
    tag: "Auth (Email ITS & OTP)",
    module: "auth",
    fn: "requestDemoOtp",
    kind: "mutation",
    summary: "Validasi email ITS (10 digit NRP) & minta kode OTP demo",
    description:
      "Memvalidasi format `/^\\d{10}@student\\.its\\.ac\\.id$/`, memeriksa ketersediaan akun untuk mode `login` atau `signup`, dan mengembalikan kode OTP demo `123456`.",
    reactHookSnippet: `const requestOtp = useMutation(api.auth.requestDemoOtp);\nawait requestOtp({ email: "0000000001@student.its.ac.id", mode: "login" });`,
    defaultArgs: {
      email: "0000000001@student.its.ac.id",
      mode: "login",
    },
    argsDescription: [
      {
        name: "email",
        type: "string",
        required: true,
        description: "Email mahasiswa ITS (10 digit NRP@student.its.ac.id)",
      },
      {
        name: "mode",
        type: '"login" | "signup"',
        required: true,
        description: "Mode autentikasi (login atau signup)",
      },
      {
        name: "name",
        type: "string",
        required: false,
        description: "Nama lengkap mahasiswa (wajib saat mode = signup)",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        email: "0000000001@student.its.ac.id",
        demoOtp: "123456",
      },
    },
  },
  {
    id: "auth-verifyDemoOtp",
    tag: "Auth (Email ITS & OTP)",
    module: "auth",
    fn: "verifyDemoOtp",
    kind: "mutation",
    summary: "Verifikasi kode OTP 123456 & buat/masuk sesi pengguna",
    description:
      "Memverifikasi kode OTP `123456`. Jika mode `signup`, membuat baris baru di tabel `users` dengan role `learner`.",
    reactHookSnippet: `const verifyOtp = useMutation(api.auth.verifyDemoOtp);\nawait verifyOtp({ email: "0000000001@student.its.ac.id", otp: "123456", mode: "login" });`,
    defaultArgs: {
      email: "0000000001@student.its.ac.id",
      otp: "123456",
      mode: "login",
    },
    argsDescription: [
      {
        name: "email",
        type: "string",
        required: true,
        description: "Email mahasiswa ITS",
      },
      {
        name: "otp",
        type: "string",
        required: true,
        description: "Kode OTP 6 digit (123456)",
      },
      {
        name: "mode",
        type: '"login" | "signup"',
        required: true,
        description: "Mode login atau signup",
      },
      {
        name: "name",
        type: "string",
        required: false,
        description: "Nama lengkap saat pendaftaran akun baru",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "user-learner-demo",
        email: "0000000001@student.its.ac.id",
        name: "Bima Pratama",
        role: "learner",
      },
    },
  },

  // 2. TUTORS & MATCHING
  {
    id: "tutors-listCourses",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "listCourses",
    kind: "query",
    summary: "Ambil daftar mata kuliah MVP (Kalkulus 1 & Fisika Dasar 1)",
    description:
      "Mengembalikan seluruh mata kuliah beserta daftar subtopik resmi SKPB ITS.",
    reactHookSnippet: `const courses = useQuery(api.tutors.listCourses, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: [
      {
        id: "course-kalkulus-1",
        code: "KM234101",
        name: "Kalkulus 1",
        description:
          "Konsep dasar fungsi, limit, turunan, serta integral satu peubah untuk mahasiswa tahun pertama ITS.",
        topics: [
          "Limit & Kekontinuan",
          "Turunan",
          "Aplikasi Turunan",
          "Integral Tak Tentu",
          "Integral Tentu",
          "Teknik Integrasi",
        ],
      },
    ],
  },
  {
    id: "tutors-getTopics",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "getTopics",
    kind: "query",
    summary: "Ambil daftar subtopik berdasarkan mata kuliah",
    description:
      "Mengembalikan daftar subtopik untuk satu mata kuliah (atau gabungan seluruh subtopik jika `courseId` dikosongkan).",
    reactHookSnippet: `const topics = useQuery(api.tutors.getTopics, { courseId: "course-kalkulus-1" });`,
    defaultArgs: { courseId: "course-kalkulus-1" },
    argsDescription: [
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "ID mata kuliah (contoh: course-kalkulus-1)",
      },
    ],
    exampleResponse: [
      "Limit & Kekontinuan",
      "Turunan",
      "Aplikasi Turunan",
      "Integral Tak Tentu",
      "Integral Tentu",
      "Teknik Integrasi",
    ],
  },
  {
    id: "tutors-listVerifiedTutors",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "listVerifiedTutors",
    kind: "query",
    summary: "Ambil semua profil tutor yang sudah terverifikasi",
    description:
      "Menggunakan index `by_verified_and_hourlyRate` untuk hanya mengembalikan tutor dengan `verified: true`.",
    reactHookSnippet: `const tutors = useQuery(api.tutors.listVerifiedTutors, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: [
      {
        id: "tutor-nadia",
        userId: "user-tutor-1",
        name: "Nadia Putri",
        department: "Matematika",
        cohort: 2023,
        hourlyRate: 45000,
        verified: true,
        badge: "asdos",
        rating: 4.9,
        slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
      },
    ],
  },
  {
    id: "tutors-getTutorById",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "getTutorById",
    kind: "query",
    summary: "Ambil profil lengkap 1 tutor (/tutor/[id])",
    description:
      "Mengambil data profil tutor terverifikasi berdasarkan `tutorId` (contoh: `tutor-nadia`).",
    reactHookSnippet: `const tutor = useQuery(api.tutors.getTutorById, { tutorId: "tutor-nadia" });`,
    defaultArgs: { tutorId: "tutor-nadia" },
    argsDescription: [
      {
        name: "tutorId",
        type: "string",
        required: true,
        description: "ID tutor (contoh: tutor-nadia, tutor-raka, tutor-salsa)",
      },
    ],
    exampleResponse: {
      id: "tutor-nadia",
      userId: "user-tutor-1",
      name: "Nadia Putri",
      department: "Matematika",
      cohort: 2023,
      bio: "Asisten dosen Kalkulus 1 (data contoh).",
      courseIds: ["course-kalkulus-1"],
      topics: ["Limit & Kekontinuan", "Turunan", "Integral Tentu"],
      hourlyRate: 45000,
      verified: true,
      badge: "asdos",
      rating: 4.9,
      completedSessionsDemo: 24,
      slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
    },
  },
  {
    id: "tutors-searchTutors",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "searchTutors",
    kind: "query",
    summary:
      "Cari & peringkatkan tutor dengan Explainable Rule-Based Matching (Bab 4.7)",
    description:
      "Menyaring tutor terverifikasi dan menghitung skor kecocokan 0–100 menggunakan rumus Bab 4.7 Brief: `S = 0.35 * M_topik + 0.30 * M_kepercayaan + 0.20 * M_anggaran + 0.15 * M_jadwal` beserta Rating Bayesian dan alasan kecocokan (`matchReasons`).",
    reactHookSnippet: `const results = useQuery(api.tutors.searchTutors, {\n  courseId: "course-kalkulus-1",\n  topic: "Integral Tentu",\n  maxBudget: 45000,\n});`,
    defaultArgs: {
      query: "Integral",
      courseId: "course-kalkulus-1",
      topic: "Integral Tentu",
      maxBudget: 45000,
      scheduleQuery: "",
    },
    argsDescription: [
      {
        name: "query",
        type: "string",
        required: false,
        description: "Kata kunci nama, departemen, bio, atau topik",
      },
      {
        name: "courseId",
        type: "string",
        required: false,
        description:
          "Filter ID mata kuliah (course-kalkulus-1 / course-fisika-dasar-1)",
      },
      {
        name: "topic",
        type: "string",
        required: false,
        description: "Filter nama subtopik spesifik",
      },
      {
        name: "maxBudget",
        type: "number | null",
        required: false,
        description: "Batas anggaran maksimal per 60 menit (Rupiah)",
      },
      {
        name: "scheduleQuery",
        type: "string",
        required: false,
        description: "Filter hari atau jam slot (contoh: Senin, Sabtu, 19:00)",
      },
    ],
    exampleResponse: [
      {
        tutor: {
          id: "tutor-nadia",
          name: "Nadia Putri",
          department: "Matematika",
          hourlyRate: 45000,
          badge: "asdos",
          rating: 4.9,
        },
        matchScore: 89,
        matchReasons: [
          "Menguasai Integral Tentu",
          "Verified Asdos",
          "Masuk anggaran",
          "3 slot cocok",
        ],
      },
    ],
  },
  {
    id: "tutors-submitApplication",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "submitApplication",
    kind: "mutation",
    summary: "Kirim formulir pendaftaran Jadi Tutor (/jadi-tutor)",
    description:
      "Menyimpan pendaftaran tutor baru dengan status `pending` (tidak self-verify; baru tampil di `/cari` setelah disetujui admin).",
    reactHookSnippet: `const submitApp = useMutation(api.tutors.submitApplication);\nawait submitApp({ userId: "user-learner-demo", name: "Bima Pratama", courseIds: ["course-kalkulus-1"], topics: ["Turunan"], bio: "Lulus Kalkulus 1 nilai A", hourlyRate: 40000, slots: ["Senin 18:30 WIB"] });`,
    defaultArgs: {
      userId: "user-learner-demo",
      name: "Bima Pratama",
      courseIds: ["course-kalkulus-1"],
      topics: ["Turunan", "Integral Tentu"],
      bio: "Pernah mendapatkan nilai A di Kalkulus 1 dan siap membantu latihan soal.",
      hourlyRate: 40000,
      slots: ["Senin 18:30 WIB", "Kamis 19:00 WIB"],
    },
    argsDescription: [
      {
        name: "userId",
        type: "string",
        required: true,
        description: "ID pengguna yang mengajukan",
      },
      {
        name: "name",
        type: "string",
        required: true,
        description: "Nama lengkap calon tutor",
      },
      {
        name: "courseIds",
        type: "string[]",
        required: true,
        description: "Daftar ID mata kuliah yang diajarkan",
      },
      {
        name: "topics",
        type: "string[]",
        required: true,
        description: "Daftar subtopik yang dikuasai",
      },
      {
        name: "bio",
        type: "string",
        required: true,
        description: "Bio singkat mengajar (minimal 15 karakter)",
      },
      {
        name: "hourlyRate",
        type: "number",
        required: true,
        description: "Tarif per 60 menit dalam Rupiah",
      },
      {
        name: "slots",
        type: "string[]",
        required: true,
        description: "Daftar slot ketersediaan mingguan (WIB)",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "app-tutor-demo",
        userId: "user-learner-demo",
        name: "Bima Pratama",
        status: "pending",
      },
    },
  },
  {
    id: "tutors-listApplications",
    tag: "Tutors & Matching Engine",
    module: "tutors",
    fn: "listApplications",
    kind: "query",
    summary: "Lihat riwayat pengajuan Jadi Tutor milik pengguna",
    description:
      "Mengambil daftar pengajuan tutor berdasarkan `userId` terurut dari yang terbaru.",
    reactHookSnippet: `const apps = useQuery(api.tutors.listApplications, { userId: "user-learner-demo" });`,
    defaultArgs: { userId: "user-learner-demo" },
    argsDescription: [
      {
        name: "userId",
        type: "string",
        required: true,
        description: "ID pengguna",
      },
    ],
    exampleResponse: [],
  },

  // 3. CHAT REAL-TIME
  {
    id: "chat-getOrCreateConversation",
    tag: "Chat Real-Time",
    module: "chat",
    fn: "getOrCreateConversation",
    kind: "mutation",
    summary: "Buka atau buat ruang percakapan Mahasiswa <-> Tutor",
    description:
      "Digunakan saat tombol `Hubungi Tutor` ditekan di halaman profil tutor. Mencegah tutor menghubungi akunnya sendiri (`SELF_CHAT_NOT_ALLOWED`).",
    reactHookSnippet: `const openChat = useMutation(api.chat.getOrCreateConversation);\nawait openChat({ learnerId: "user-learner-demo", tutorId: "tutor-nadia" });`,
    defaultArgs: {
      learnerId: "user-learner-demo",
      tutorId: "tutor-nadia",
    },
    argsDescription: [
      {
        name: "learnerId",
        type: "string",
        required: true,
        description: "ID pengguna mahasiswa",
      },
      {
        name: "tutorId",
        type: "string",
        required: true,
        description: "ID profil tutor",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "conv-demo-seed-1",
        learnerId: "user-learner-demo",
        tutorId: "tutor-nadia",
        lastMessageAt: 1795503900000,
      },
    },
  },
  {
    id: "chat-listConversations",
    tag: "Chat Real-Time",
    module: "chat",
    fn: "listConversations",
    kind: "query",
    summary: "Ambil daftar percakapan pengguna beserta jumlah pesan belum dibaca",
    description:
      "Mengembalikan ringkasan percakapan (`ConversationSummary`) untuk sidebar `/chat`, termasuk pesan terakhir dan `unreadCount`.",
    reactHookSnippet: `const conversations = useQuery(api.chat.listConversations, { userId: "user-learner-demo" });`,
    defaultArgs: { userId: "user-learner-demo" },
    argsDescription: [
      {
        name: "userId",
        type: "string",
        required: true,
        description: "ID pengguna aktif (Mahasiswa atau Tutor)",
      },
    ],
    exampleResponse: [
      {
        conversation: {
          id: "conv-demo-seed-1",
          learnerId: "user-learner-demo",
          tutorId: "tutor-nadia",
        },
        peerName: "Nadia Putri",
        peerRoleLabel: "Tutor",
        unreadCount: 1,
      },
    ],
  },
  {
    id: "chat-listMessages",
    tag: "Chat Real-Time",
    module: "chat",
    fn: "listMessages",
    kind: "query",
    summary: "Ambil seluruh bubble pesan dalam 1 ruang chat secara real-time",
    description:
      "Mengambil pesan teks (`type: 'text'`) maupun kartu tawaran sesi (`type: 'offer'`) terurut secara kronologis.",
    reactHookSnippet: `const messages = useQuery(api.chat.listMessages, { conversationId: "conv-demo-seed-1" });`,
    defaultArgs: { conversationId: "conv-demo-seed-1" },
    argsDescription: [
      {
        name: "conversationId",
        type: "string",
        required: true,
        description: "ID percakapan (contoh: conv-demo-seed-1)",
      },
    ],
    exampleResponse: [
      {
        id: "msg-seed-1",
        conversationId: "conv-demo-seed-1",
        senderId: "user-learner-demo",
        type: "text",
        content:
          "Halo Kak Nadia, apakah bisa bantu bahas soal Integral Tentu untuk persiapan kuis minggu depan?",
        createdAt: 1795503600000,
      },
    ],
  },
  {
    id: "chat-sendMessage",
    tag: "Chat Real-Time",
    module: "chat",
    fn: "sendMessage",
    kind: "mutation",
    summary: "Kirim bubble pesan teks baru ke ruang chat",
    description:
      "Memvalidasi bahwa pengirim adalah peserta percakapan (Mahasiswa atau Tutor), menyimpan bubble pesan baru, dan memperbarui `lastMessageAt`.",
    reactHookSnippet: `const sendMsg = useMutation(api.chat.sendMessage);\nawait sendMsg({ conversationId: "conv-demo-seed-1", senderId: "user-learner-demo", content: "Siap Kak, terima kasih!" });`,
    defaultArgs: {
      conversationId: "conv-demo-seed-1",
      senderId: "user-learner-demo",
      content: "Halo Kak Nadia, saya siap untuk sesi Kamis malam.",
    },
    argsDescription: [
      {
        name: "conversationId",
        type: "string",
        required: true,
        description: "ID percakapan",
      },
      {
        name: "senderId",
        type: "string",
        required: true,
        description: "ID pengirim pesan",
      },
      {
        name: "content",
        type: "string",
        required: true,
        description: "Isi teks pesan chat",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "msg-example",
        conversationId: "conv-demo-seed-1",
        senderId: "user-learner-demo",
        type: "text",
        content: "Halo Kak Nadia, saya siap untuk sesi Kamis malam.",
      },
    },
  },
  {
    id: "chat-markRead",
    tag: "Chat Real-Time",
    module: "chat",
    fn: "markRead",
    kind: "mutation",
    summary: "Tandai seluruh pesan lawan bicara sebagai sudah dibaca",
    description:
      "Mengisi timestamp `readAt` untuk seluruh pesan di ruang chat yang belum dibaca oleh `readerId`.",
    reactHookSnippet: `const markRead = useMutation(api.chat.markRead);\nawait markRead({ conversationId: "conv-demo-seed-1", readerId: "user-learner-demo" });`,
    defaultArgs: {
      conversationId: "conv-demo-seed-1",
      readerId: "user-learner-demo",
    },
    argsDescription: [
      {
        name: "conversationId",
        type: "string",
        required: true,
        description: "ID percakapan",
      },
      {
        name: "readerId",
        type: "string",
        required: true,
        description: "ID pembaca pesan",
      },
    ],
    exampleResponse: null,
  },

  // 4. BOOKINGS & ANTI-BENTROK
  {
    id: "bookings-getBookingById",
    tag: "Bookings & Anti-Bentrok",
    module: "bookings",
    fn: "getBookingById",
    kind: "query",
    summary: "Ambil detail 1 booking / tawaran sesi berdasarkan ID",
    description: "Mencari data sesi di tabel `bookings` dengan index `by_appId`.",
    reactHookSnippet: `const booking = useQuery(api.bookings.getBookingById, { bookingId: "bk-example" });`,
    defaultArgs: { bookingId: "bk-example" },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking sesi",
      },
    ],
    exampleResponse: null,
  },
  {
    id: "bookings-createOffer",
    tag: "Bookings & Anti-Bentrok",
    module: "bookings",
    fn: "createOffer",
    kind: "mutation",
    summary: "Tutor membuat kartu tawaran sesi belajar di dalam ruang chat",
    description:
      "Hanya dapat dipanggil oleh Tutor pada percakapan tersebut. Membuat baris di `bookings` dengan `status: 'offered'` dan mengirim pesan bubble `type: 'offer'` ke ruang chat.",
    reactHookSnippet: `const createOffer = useMutation(api.bookings.createOffer);\nawait createOffer({ conversationId: "conv-demo-seed-1", actorUserId: "user-tutor-1", courseId: "course-kalkulus-1", topic: "Integral Tentu", startAt: Date.now() + 86400000, price: 45000, meetingMode: "online" });`,
    defaultArgs: {
      conversationId: "conv-demo-seed-1",
      actorUserId: "user-tutor-1",
      courseId: "course-kalkulus-1",
      topic: "Integral Tentu",
      startAt: 1800000000000,
      price: 45000,
      meetingMode: "online",
      brief: "Fokus bahas Teorema Fundamental Kalkulus dan latihan soal kuis.",
    },
    argsDescription: [
      {
        name: "conversationId",
        type: "string",
        required: true,
        description: "ID percakapan",
      },
      {
        name: "actorUserId",
        type: "string",
        required: true,
        description: "ID akun user milik Tutor (contoh: user-tutor-1)",
      },
      {
        name: "courseId",
        type: "string",
        required: true,
        description: "ID mata kuliah",
      },
      {
        name: "topic",
        type: "string",
        required: true,
        description: "Subtopik yang akan dibahas",
      },
      {
        name: "startAt",
        type: "number",
        required: true,
        description: "Timestamp jadwal mulai sesi (epoch ms mendatang)",
      },
      {
        name: "price",
        type: "number",
        required: true,
        description: "Tarif sesi 60 menit dalam Rupiah",
      },
      {
        name: "meetingMode",
        type: '"online" | "offline_its"',
        required: false,
        description: "Mode pertemuan (online atau tatap muka di kampus ITS)",
      },
      {
        name: "brief",
        type: "string",
        required: false,
        description: "Catatan persiapan / Pre-Session Brief",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "bk-example",
        conversationId: "conv-demo-seed-1",
        learnerId: "user-learner-demo",
        tutorId: "tutor-nadia",
        courseId: "course-kalkulus-1",
        topic: "Integral Tentu",
        durationMinutes: 60,
        price: 45000,
        status: "offered",
      },
    },
  },
  {
    id: "bookings-acceptOffer",
    tag: "Bookings & Anti-Bentrok",
    module: "bookings",
    fn: "acceptOffer",
    kind: "mutation",
    summary:
      "Mahasiswa menerima tawaran sesi (ACID Transaction Anti-Bentrok Jadwal)",
    description:
      "Mengecek apakah jadwal belum lewat (`OFFER_EXPIRED`), memastikan tidak ada sesi lain milik tutor tersebut yang beririsan dalam rentang 60 menit (`SCHEDULE_CONFLICT`), mengubah status menjadi `accepted`, dan menyiapkan tagihan `unpaid` di tabel `payments`.",
    reactHookSnippet: `const acceptOffer = useMutation(api.bookings.acceptOffer);\nawait acceptOffer({ bookingId: "bk-example", actorUserId: "user-learner-demo" });`,
    defaultArgs: {
      bookingId: "bk-example",
      actorUserId: "user-learner-demo",
    },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking tawaran sesi",
      },
      {
        name: "actorUserId",
        type: "string",
        required: true,
        description: "ID akun mahasiswa penerima tawaran",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "bk-example",
        status: "accepted",
      },
    },
  },
  {
    id: "bookings-declineOffer",
    tag: "Bookings & Anti-Bentrok",
    module: "bookings",
    fn: "declineOffer",
    kind: "mutation",
    summary: "Mahasiswa menolak tawaran sesi",
    description:
      "Mengubah status booking dari `offered` menjadi `declined`.",
    reactHookSnippet: `const declineOffer = useMutation(api.bookings.declineOffer);\nawait declineOffer({ bookingId: "bk-example", actorUserId: "user-learner-demo" });`,
    defaultArgs: {
      bookingId: "bk-example",
      actorUserId: "user-learner-demo",
    },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking tawaran sesi",
      },
      {
        name: "actorUserId",
        type: "string",
        required: true,
        description: "ID akun mahasiswa",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "bk-example",
        status: "declined",
      },
    },
  },

  // 5. PAYMENTS (QRIS DEMO)
  {
    id: "payments-getCheckoutByBooking",
    tag: "Payments (QRIS Demo)",
    module: "payments",
    fn: "getCheckoutByBooking",
    kind: "query",
    summary:
      "Ambil data lengkap halaman Pembayaran (/pembayaran/[id]): Tutor, Matkul, Harga, Status",
    description:
      "Menggabungkan data `booking`, `payment`, `tutor`, `learner`, dan `course` untuk ditampilkan pada ringkasan pembayaran QRIS.",
    reactHookSnippet: `const checkout = useQuery(api.payments.getCheckoutByBooking, { bookingId: "bk-example" });`,
    defaultArgs: { bookingId: "bk-example" },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking yang sudah diterima (accepted/paid)",
      },
    ],
    exampleResponse: null,
  },
  {
    id: "payments-startPayment",
    tag: "Payments (QRIS Demo)",
    module: "payments",
    fn: "startPayment",
    kind: "mutation",
    summary: "Klik tombol Bayar untuk membuka panel QRIS Demo",
    description:
      "Memastikan pemesanan berstatus `accepted` dan belum lunas (`ALREADY_PAID`), lalu menginisialisasi record `payments` dengan status `unpaid`.",
    reactHookSnippet: `const startPay = useMutation(api.payments.startPayment);\nawait startPay({ bookingId: "bk-example", actorUserId: "user-learner-demo" });`,
    defaultArgs: {
      bookingId: "bk-example",
      actorUserId: "user-learner-demo",
    },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking",
      },
      {
        name: "actorUserId",
        type: "string",
        required: true,
        description: "ID mahasiswa pemesan",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "pay-bk-example",
        bookingId: "bk-example",
        amount: 45000,
        status: "unpaid",
      },
    },
  },
  {
    id: "payments-submitDemoProof",
    tag: "Payments (QRIS Demo)",
    module: "payments",
    fn: "submitDemoProof",
    kind: "mutation",
    summary: "Kirim bukti pembayaran QRIS Demo (ubah ke pending_verification)",
    description:
      "Menyimpan nama file bukti pembayaran simulasi dan mengubah status pembayaran menjadi `pending_verification`.",
    reactHookSnippet: `const submitProof = useMutation(api.payments.submitDemoProof);\nawait submitProof({ bookingId: "bk-example", actorUserId: "user-learner-demo", proofName: "bukti-qris-bima.png" });`,
    defaultArgs: {
      bookingId: "bk-example",
      actorUserId: "user-learner-demo",
      proofName: "bukti-qris-bima.png",
    },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking",
      },
      {
        name: "actorUserId",
        type: "string",
        required: true,
        description: "ID mahasiswa pemesan",
      },
      {
        name: "proofName",
        type: "string",
        required: false,
        description: "Nama file bukti pembayaran simulasi",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "pay-bk-example",
        bookingId: "bk-example",
        amount: 45000,
        status: "pending_verification",
        proofName: "bukti-qris-bima.png",
      },
    },
  },
  {
    id: "payments-simulateVerification",
    tag: "Payments (QRIS Demo)",
    module: "payments",
    fn: "simulateVerification",
    kind: "mutation",
    summary:
      "Simulasikan verifikasi admin (Approve -> Lunas & Pop-up Success / Reject)",
    description:
      "Saat `decision: 'approve'`, mengubah status `payment` dan `booking` menjadi `paid` sehingga memicu Pop-up Success di layar pembayaran.",
    reactHookSnippet: `const verifyPay = useMutation(api.payments.simulateVerification);\nawait verifyPay({ bookingId: "bk-example", decision: "approve" });`,
    defaultArgs: {
      bookingId: "bk-example",
      decision: "approve",
    },
    argsDescription: [
      {
        name: "bookingId",
        type: "string",
        required: true,
        description: "ID booking",
      },
      {
        name: "decision",
        type: '"approve" | "reject"',
        required: true,
        description: "Keputusan verifikasi (approve = lunas, reject = tolak)",
      },
    ],
    exampleResponse: {
      ok: true,
      data: {
        id: "pay-bk-example",
        bookingId: "bk-example",
        amount: 45000,
        status: "paid",
      },
    },
  },

  // 6. ADMIN & PILOT METRICS
  {
    id: "metrics-getPilotMetrics",
    tag: "Admin & Pilot Metrics",
    module: "metrics",
    fn: "getPilotMetrics",
    kind: "query",
    summary: "Ekstraksi metrik pilot otomatis dari database (Bab 6.1 Brief)",
    description:
      "Menghitung statistik platform secara langsung dari database Convex: jumlah user, tutor terverifikasi, tingkat penerimaan sesi (%), penyelesaian pembayaran (%), rata-rata rating tutor, dan total nilai transaksi.",
    reactHookSnippet: `const metrics = useQuery(api.metrics.getPilotMetrics, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: {
      totalUsers: 6,
      totalLearners: 1,
      totalVerifiedTutors: 5,
      pendingTutorApplications: 0,
      totalConversations: 1,
      totalMessages: 2,
      totalBookings: 0,
      acceptedOrPaidBookings: 0,
      paidBookings: 0,
      acceptanceRatePercent: 0,
      paymentCompletionRatePercent: 0,
      averageTutorRating: 4.82,
      totalRevenueIdr: 0,
    },
  },
  {
    id: "admin-listPendingApplications",
    tag: "Admin & Pilot Metrics",
    module: "admin",
    fn: "listPendingApplications",
    kind: "query",
    summary: "Daftar pendaftaran Jadi Tutor yang menunggu verifikasi admin",
    description:
      "Mengambil seluruh baris `tutorApplications` dengan status `pending`.",
    reactHookSnippet: `const pending = useQuery(api.admin.listPendingApplications, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: [],
  },
  {
    id: "admin-approveTutorApplication",
    tag: "Admin & Pilot Metrics",
    module: "admin",
    fn: "approveTutorApplication",
    kind: "mutation",
    summary: "Setujui pendaftaran Jadi Tutor & aktifkan profil tutor di /cari",
    description:
      "Mengubah role user menjadi `tutor`, membuat profil di tabel `tutors` dengan `verified: true` dan lencana (`grade` / `asdos`), serta menghapus antrean aplikasi pending.",
    reactHookSnippet: `const approve = useMutation(api.admin.approveTutorApplication);\nawait approve({ applicationId: "app-tutor-xxx", department: "Teknik Informatika", cohort: 2023, badge: "grade" });`,
    defaultArgs: {
      applicationId: "app-tutor-example",
      department: "Teknik Informatika",
      cohort: 2023,
      badge: "grade",
    },
    argsDescription: [
      {
        name: "applicationId",
        type: "string",
        required: true,
        description: "ID pengajuan tutor",
      },
      {
        name: "department",
        type: "string",
        required: false,
        description: "Departemen ITS tutor",
      },
      {
        name: "cohort",
        type: "number",
        required: false,
        description: "Tahun angkatan tutor",
      },
      {
        name: "badge",
        type: '"grade" | "asdos"',
        required: false,
        description: "Lencana verifikasi (grade atau asdos)",
      },
    ],
    exampleResponse: {
      ok: false,
      error: "Pengajuan tutor tidak ditemukan.",
    },
  },

  // 7. SEED & APP STATE
  {
    id: "state-getAppState",
    tag: "Seed & App State",
    module: "state",
    fn: "getAppState",
    kind: "query",
    summary: "Ambil snapshot reaktif seluruh tabel Convex",
    description:
      "Digunakan oleh `ConvexRealtimeBridge` untuk menyinkronkan database Convex secara real-time ke seluruh komponen UI.",
    reactHookSnippet: `const appState = useQuery(api.state.getAppState, {});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: {
      seeded: true,
      users: [],
      courses: [],
      tutors: [],
    },
  },
  {
    id: "seed-ensureSeeded",
    tag: "Seed & App State",
    module: "seed",
    fn: "ensureSeeded",
    kind: "mutation",
    summary: "Inisialisasi data awal (idempoten) jika database masih kosong",
    description:
      "Mengisi 2 mata kuliah, 5 tutor terverifikasi, 6 akun demo, dan percakapan awal jika belum ada di database.",
    reactHookSnippet: `const ensureSeeded = useMutation(api.seed.ensureSeeded);\nawait ensureSeeded({});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: { seeded: false },
  },
  {
    id: "seed-resetDemoData",
    tag: "Seed & App State",
    module: "seed",
    fn: "resetDemoData",
    kind: "mutation",
    summary: "Reset seluruh database Convex kembali ke kondisi seed awal",
    description:
      "Dipanggil oleh tombol `Reset Demo` di banner atas aplikasi untuk mengembalikan seluruh data ke kondisi awal.",
    reactHookSnippet: `const resetDemo = useMutation(api.seed.resetDemoData);\nawait resetDemo({});`,
    defaultArgs: {},
    argsDescription: [],
    exampleResponse: { reset: true },
  },
];

export function buildOpenApiSpec(baseUrl = "http://localhost:3000") {
  const paths: Record<string, unknown> = {};

  for (const ep of API_ENDPOINTS_CATALOG) {
    const routePath = `/api/convex/${ep.module}/${ep.fn}`;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const arg of ep.argsDescription) {
      properties[arg.name] = {
        type: arg.type.includes("number")
          ? "number"
          : arg.type.includes("[]")
            ? "array"
            : "string",
        description: arg.description,
      };
      if (arg.required) {
        required.push(arg.name);
      }
    }

    paths[routePath] = {
      post: {
        tags: [ep.tag],
        operationId: `${ep.module}_${ep.fn}`,
        summary: `[${ep.kind.toUpperCase()}] ${ep.summary}`,
        description: `${ep.description}\n\n**Convex React Hook:**\n\`\`\`ts\n${ep.reactHookSnippet}\n\`\`\``,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties,
                ...(required.length > 0 ? { required } : {}),
              },
              example: ep.defaultArgs,
            },
          },
        },
        responses: {
          "200": {
            description: "Berhasil dieksekusi oleh Convex Backend",
            content: {
              "application/json": {
                example: {
                  ok: true,
                  function: `${ep.module}:${ep.fn}`,
                  kind: ep.kind,
                  result: ep.exampleResponse,
                },
              },
            },
          },
          "400": {
            description: "Parameter request tidak valid",
          },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "KOLEARA — Convex Backend API Documentation",
      version: "1.0.0",
      description:
        "Dokumentasi OpenAPI 3.0 & Interactive Playground untuk seluruh fungsi Query dan Mutation Convex pada platform Peer Tutoring Mahasiswa ITS (KOLEARA).",
      contact: {
        name: "Tim PENGEN MENANG PLIS — STACK 2026",
      },
    },
    servers: [
      {
        url: baseUrl,
        description: "Next.js + Convex API Bridge Server",
      },
    ],
    tags: [
      {
        name: "Auth (Email ITS & OTP)",
        description:
          "Validasi email mahasiswa ITS (10 digit NRP@student.its.ac.id) & OTP demo 123456",
      },
      {
        name: "Tutors & Matching Engine",
        description:
          "Katalog mata kuliah, profil tutor terverifikasi, pendaftaran Jadi Tutor, dan Explainable Rule-Based Matching (Bab 4.7 Brief)",
      },
      {
        name: "Chat Real-Time",
        description:
          "Ruang percakapan mahasiswa & tutor, pengiriman bubble pesan teks real-time, dan status baca",
      },
      {
        name: "Bookings & Anti-Bentrok",
        description:
          "Pembuatan kartu tawaran sesi belajar di chat dan penerimaan sesi dengan pengecekan anti-bentrok jadwal (ACID Transaction)",
      },
      {
        name: "Payments (QRIS Demo)",
        description:
          "Ringkasan pembayaran sesi, aktivasi QRIS Demo, pengiriman bukti pembayaran simulasi, dan verifikasi lunas (Pop-up Success)",
      },
      {
        name: "Admin & Pilot Metrics",
        description:
          "Persetujuan pendaftaran tutor baru dan ekstraksi otomatis metrik pilot Bab 6.1 Brief",
      },
      {
        name: "Seed & App State",
        description:
          "Sinkronisasi state reaktif Convex dan fungsi inisialisasi/reset data demo",
      },
    ],
    paths,
  };
}
