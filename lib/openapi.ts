export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ParamDoc = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  description: string;
};

export type StatusCodeDoc = {
  code: number;
  when: string;
};

export type RestEndpointDoc = {
  id: string;
  tag:
    | "Health"
    | "Auth"
    | "Courses & Tutors"
    | "Chat"
    | "Bookings"
    | "Payments"
    | "Admin";
  folderSeq: number;
  seq: number;
  name: string;
  method: HttpMethod;
  pathTemplate: string; // e.g. /api/tutors/:tutor_id
  openApiPath: string; // e.g. /api/tutors/{tutor_id}
  convexFunction: string; // e.g. tutors:getTutorById (QUERY)
  summary: string;
  description: string;
  pathParams: ParamDoc[];
  queryParams: ParamDoc[];
  bodyFields: ParamDoc[];
  defaultBody?: Record<string, unknown>;
  statusCodes: StatusCodeDoc[];
  exampleResponse: {
    success: boolean;
    message: string;
    data: unknown;
    meta?: Record<string, unknown>;
  };
};

export const REST_ENDPOINTS_CATALOG: RestEndpointDoc[] = [
  // ============================================================================
  // 1. HEALTH
  // ============================================================================
  {
    id: "health-check",
    tag: "Health",
    folderSeq: 1,
    seq: 1,
    name: "Health Check",
    method: "GET",
    pathTemplate: "/api/health",
    openApiPath: "/api/health",
    convexFunction: "state:getAppState (QUERY)",
    summary: "Cek status layanan API dan koneksi database Convex",
    description:
      "Memeriksa apakah server API KOLEARA dan koneksi database Convex berjalan normal.",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Layanan API & database siap" }],
    exampleResponse: {
      success: true,
      message: "Layanan KOLEARA API aktif.",
      data: {
        status: "ok",
        engine: "convex",
        timestamp: "2026-11-25T12:00:00.000Z",
      },
    },
  },

  // ============================================================================
  // 2. AUTH
  // ============================================================================
  {
    id: "auth-request-otp",
    tag: "Auth",
    folderSeq: 2,
    seq: 1,
    name: "Minta Kode OTP",
    method: "POST",
    pathTemplate: "/api/auth/request-otp",
    openApiPath: "/api/auth/request-otp",
    convexFunction: "auth:requestDemoOtp (MUTATION)",
    summary: "Validasi email mahasiswa ITS & minta kode OTP 6 digit",
    description:
      "Memvalidasi format wajib `10 digit NRP@student.its.ac.id` dan mengirim kode OTP (`123456` pada mode demo).",
    pathParams: [],
    queryParams: [],
    bodyFields: [
      {
        name: "email",
        type: "string",
        required: true,
        defaultValue: "0000000001@student.its.ac.id",
        description: "Email mahasiswa ITS (10 digit NRP@student.its.ac.id)",
      },
      {
        name: "mode",
        type: "string",
        required: true,
        defaultValue: "login",
        description: "`login` untuk akun terdaftar, `signup` untuk akun baru",
      },
      {
        name: "name",
        type: "string",
        required: false,
        defaultValue: "",
        description: "Nama lengkap mahasiswa (wajib saat `mode = signup`)",
      },
    ],
    defaultBody: {
      email: "0000000001@student.its.ac.id",
      mode: "login",
    },
    statusCodes: [
      { code: 200, when: "Kode OTP berhasil dibuat" },
      { code: 400, when: "Format email bukan 10 digit NRP@student.its.ac.id" },
      { code: 404, when: "Email belum terdaftar saat mode `login`" },
      { code: 409, when: "Email sudah terdaftar saat mode `signup`" },
    ],
    exampleResponse: {
      success: true,
      message: "Kode OTP berhasil dikirim.",
      data: {
        email: "0000000001@student.its.ac.id",
        demo_otp: "123456",
      },
    },
  },
  {
    id: "auth-login-otp",
    tag: "Auth",
    folderSeq: 2,
    seq: 2,
    name: "Login Akun (Verifikasi OTP)",
    method: "POST",
    pathTemplate: "/api/auth/verify-otp",
    openApiPath: "/api/auth/verify-otp",
    convexFunction: "auth:verifyDemoOtp (MUTATION)",
    summary: "Verifikasi kode OTP untuk login atau registrasi akun ITS",
    description:
      "Memverifikasi kode OTP 6 digit (`123456`). Jika `mode = signup`, otomatis membuat user baru dengan role `learner`.",
    pathParams: [],
    queryParams: [],
    bodyFields: [
      {
        name: "email",
        type: "string",
        required: true,
        defaultValue: "0000000001@student.its.ac.id",
        description: "Email mahasiswa ITS",
      },
      {
        name: "otp",
        type: "string",
        required: true,
        defaultValue: "123456",
        description: "Kode OTP 6 digit (`123456`)",
      },
      {
        name: "mode",
        type: "string",
        required: true,
        defaultValue: "login",
        description: "`login` atau `signup`",
      },
      {
        name: "name",
        type: "string",
        required: false,
        defaultValue: "Bima Pratama",
        description: "Nama lengkap mahasiswa (wajib saat `mode = signup`)",
      },
    ],
    defaultBody: {
      email: "0000000001@student.its.ac.id",
      otp: "123456",
      mode: "login",
    },
    statusCodes: [
      { code: 200, when: "Autentikasi berhasil" },
      { code: 400, when: "Format email atau kode OTP tidak valid" },
      { code: 404, when: "Akun belum terdaftar saat `mode = login`" },
      { code: 409, when: "Email sudah terdaftar saat `mode = signup`" },
    ],
    exampleResponse: {
      success: true,
      message: "Verifikasi OTP berhasil.",
      data: {
        id: "user-learner-demo",
        email: "0000000001@student.its.ac.id",
        name: "Bima Pratama",
        role: "learner",
      },
    },
  },
  {
    id: "users-list",
    tag: "Auth",
    folderSeq: 2,
    seq: 3,
    name: "Ambil Daftar User",
    method: "GET",
    pathTemplate: "/api/users",
    openApiPath: "/api/users",
    convexFunction: "auth:listUsers (QUERY)",
    summary: "Ambil daftar seluruh akun pengguna (Mahasiswa & Tutor)",
    description:
      "Mengambil daftar akun pengguna terdaftar. Dapat difilter berdasarkan `role` (`learner` atau `tutor`).",
    pathParams: [],
    queryParams: [
      {
        name: "role",
        type: "string",
        required: false,
        defaultValue: "",
        description: "Filter peran pengguna: `learner` atau `tutor`",
      },
    ],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Berhasil mengambil daftar user" }],
    exampleResponse: {
      success: true,
      message: "Data user berhasil diambil.",
      data: [
        {
          id: "user-learner-demo",
          email: "0000000001@student.its.ac.id",
          name: "Bima Pratama",
          role: "learner",
        },
        {
          id: "user-tutor-1",
          email: "0000000101@student.its.ac.id",
          name: "Nadia Putri",
          role: "tutor",
        },
      ],
    },
  },
  {
    id: "users-detail",
    tag: "Auth",
    folderSeq: 2,
    seq: 4,
    name: "Ambil Detail User",
    method: "GET",
    pathTemplate: "/api/users/:user_id",
    openApiPath: "/api/users/{user_id}",
    convexFunction: "auth:getUserById (QUERY)",
    summary: "Ambil detail satu akun user berdasarkan ID",
    description: "Mengambil profil dasar satu pengguna dari tabel `users`.",
    pathParams: [
      {
        name: "user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID pengguna (contoh: `user-learner-demo`, `user-tutor-1`)",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "User ditemukan" },
      { code: 404, when: "User tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Detail user berhasil diambil.",
      data: {
        id: "user-learner-demo",
        email: "0000000001@student.its.ac.id",
        name: "Bima Pratama",
        role: "learner",
      },
    },
  },

  // ============================================================================
  // 3. COURSES & TUTORS
  // ============================================================================
  {
    id: "courses-list",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 1,
    name: "Ambil Daftar Mata Kuliah",
    method: "GET",
    pathTemplate: "/api/courses",
    openApiPath: "/api/courses",
    convexFunction: "tutors:listCourses (QUERY)",
    summary: "Ambil katalog mata kuliah MVP (Kalkulus 1 & Fisika Dasar 1)",
    description:
      "Mengambil seluruh mata kuliah SKPB ITS beserta kode mata kuliah dan daftar subtopik resminya.",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Daftar mata kuliah berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Data mata kuliah berhasil diambil.",
      data: [
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
  },
  {
    id: "courses-topics",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 2,
    name: "Ambil Subtopik Mata Kuliah",
    method: "GET",
    pathTemplate: "/api/courses/:course_id/topics",
    openApiPath: "/api/courses/{course_id}/topics",
    convexFunction: "tutors:getTopics (QUERY)",
    summary: "Ambil daftar subtopik untuk satu mata kuliah",
    description:
      "Mengambil array subtopik berdasarkan `course_id` (misalnya `course-kalkulus-1` atau `course-fisika-dasar-1`).",
    pathParams: [
      {
        name: "course_id",
        type: "string",
        required: true,
        defaultValue: "course-kalkulus-1",
        description:
          "ID mata kuliah (`course-kalkulus-1` atau `course-fisika-dasar-1`)",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "Daftar subtopik berhasil diambil" },
      { code: 404, when: "Mata kuliah tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Daftar subtopik berhasil diambil.",
      data: [
        "Limit & Kekontinuan",
        "Turunan",
        "Aplikasi Turunan",
        "Integral Tak Tentu",
        "Integral Tentu",
        "Teknik Integrasi",
      ],
    },
  },
  {
    id: "tutors-search",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 3,
    name: "Cari Tutor (Matching Engine)",
    method: "GET",
    pathTemplate: "/api/tutors",
    openApiPath: "/api/tutors",
    convexFunction: "tutors:searchTutors (QUERY)",
    summary:
      "Cari & peringkatkan tutor terverifikasi dengan Explainable Matching Score (0-100)",
    description:
      "Menyaring tutor terverifikasi dan menghitung skor kecocokan menggunakan rumus Bab 4.7 Brief: `S = 0.35 * M_topik + 0.30 * M_kepercayaan + 0.20 * M_anggaran + 0.15 * M_jadwal` beserta Rating Bayesian. Semua query filter bersifat opsional.",
    pathParams: [],
    queryParams: [
      {
        name: "query",
        type: "string",
        required: false,
        defaultValue: "Integral",
        description: "Kata kunci nama tutor, departemen, bio, atau subtopik",
      },
      {
        name: "course_id",
        type: "string",
        required: false,
        defaultValue: "course-kalkulus-1",
        description:
          "ID mata kuliah (`course-kalkulus-1` / `course-fisika-dasar-1`)",
      },
      {
        name: "topic",
        type: "string",
        required: false,
        defaultValue: "Integral Tentu",
        description: "Nama subtopik spesifik",
      },
      {
        name: "max_budget",
        type: "number",
        required: false,
        defaultValue: "45000",
        description: "Batas tarif maksimal per 60 menit dalam Rupiah",
      },
      {
        name: "schedule",
        type: "string",
        required: false,
        defaultValue: "",
        description: "Filter hari atau jam slot (contoh: `Senin`, `Sabtu`, `19:00`)",
      },
    ],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Hasil pencarian tutor berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Daftar tutor berhasil diambil.",
      data: [
        {
          tutor: {
            id: "tutor-nadia",
            userId: "user-tutor-1",
            name: "Nadia Putri",
            department: "Matematika",
            cohort: 2023,
            hourlyRate: 45000,
            verified: true,
            badge: "asdos",
            rating: 4.9,
            completedSessionsDemo: 24,
            slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
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
      meta: { count: 3 },
    },
  },
  {
    id: "tutors-detail",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 4,
    name: "Ambil Detail Tutor",
    method: "GET",
    pathTemplate: "/api/tutors/:tutor_id",
    openApiPath: "/api/tutors/{tutor_id}",
    convexFunction: "tutors:getTutorById (QUERY)",
    summary: "Ambil detail profil lengkap 1 tutor terverifikasi",
    description:
      "Digunakan pada halaman `/tutor/[id]` untuk menampilkan bio, lencana verifikasi (`asdos` / `grade`), daftar mata kuliah & subtopik, tarif, dan jadwal slot ketersediaan.",
    pathParams: [
      {
        name: "tutor_id",
        type: "string",
        required: true,
        defaultValue: "tutor-nadia",
        description:
          "ID tutor (`tutor-nadia`, `tutor-raka`, `tutor-salsa`, `tutor-dimas`, `tutor-alya`)",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "Profil tutor ditemukan" },
      { code: 404, when: "Tutor tidak ditemukan atau belum terverifikasi" },
    ],
    exampleResponse: {
      success: true,
      message: "Detail tutor berhasil diambil.",
      data: {
        id: "tutor-nadia",
        userId: "user-tutor-1",
        name: "Nadia Putri",
        department: "Matematika",
        cohort: 2023,
        bio: "Asisten dosen Kalkulus 1 (data contoh). Terbiasa membantu latihan soal ETS/EAS mulai dari limit hingga teknik integrasi dengan langkah terstruktur.",
        courseIds: ["course-kalkulus-1"],
        topics: [
          "Limit & Kekontinuan",
          "Turunan",
          "Integral Tak Tentu",
          "Integral Tentu",
          "Teknik Integrasi",
        ],
        hourlyRate: 45000,
        verified: true,
        badge: "asdos",
        rating: 4.9,
        completedSessionsDemo: 24,
        slots: ["Senin 18:30 WIB", "Rabu 19:00 WIB", "Sabtu 10:00 WIB"],
      },
    },
  },
  {
    id: "tutor-applications-create",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 5,
    name: "Daftar Jadi Tutor",
    method: "POST",
    pathTemplate: "/api/tutor-applications",
    openApiPath: "/api/tutor-applications",
    convexFunction: "tutors:submitApplication (MUTATION)",
    summary: "Ajukan pendaftaran sebagai tutor sebaya (/jadi-tutor)",
    description:
      "Menyimpan pengajuan tutor baru dengan status `pending`. Pengajuan tidak langsung aktif di pencarian sebelum disetujui admin.",
    pathParams: [],
    queryParams: [],
    bodyFields: [
      {
        name: "user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID akun pengguna yang mendaftar",
      },
      {
        name: "name",
        type: "string",
        required: true,
        defaultValue: "Bima Pratama",
        description: "Nama lengkap calon tutor (minimal 2 karakter)",
      },
      {
        name: "course_ids",
        type: "string[]",
        required: true,
        defaultValue: '["course-kalkulus-1"]',
        description: "Array ID mata kuliah yang diajarkan",
      },
      {
        name: "topics",
        type: "string[]",
        required: true,
        defaultValue: '["Turunan", "Integral Tentu"]',
        description: "Array subtopik yang dikuasai",
      },
      {
        name: "bio",
        type: "string",
        required: true,
        defaultValue:
          "Pernah mendapat nilai A di Kalkulus 1 dan siap membimbing konsep dasar secara bertahap.",
        description: "Bio singkat mengajar (minimal 15 karakter)",
      },
      {
        name: "hourly_rate",
        type: "number",
        required: true,
        defaultValue: "40000",
        description: "Tarif per 60 menit dalam Rupiah",
      },
      {
        name: "slots",
        type: "string[]",
        required: true,
        defaultValue: '["Senin 18:30 WIB", "Kamis 19:00 WIB"]',
        description: "Array slot jadwal ketersediaan mingguan",
      },
    ],
    defaultBody: {
      user_id: "user-learner-demo",
      name: "Bima Pratama",
      course_ids: ["course-kalkulus-1"],
      topics: ["Turunan", "Integral Tentu"],
      bio: "Pernah mendapat nilai A di Kalkulus 1 dan siap membimbing konsep dasar secara bertahap.",
      hourly_rate: 40000,
      slots: ["Senin 18:30 WIB", "Kamis 19:00 WIB"],
    },
    statusCodes: [
      { code: 201, when: "Pengajuan tutor berhasil disimpan (status `pending`)" },
      { code: 400, when: "Validasi form gagal (bio kurang panjang, tarif tidak valid)" },
      { code: 404, when: "User tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Pengajuan pendaftaran tutor berhasil dikirim.",
      data: {
        id: "app-tutor-demo",
        userId: "user-learner-demo",
        name: "Bima Pratama",
        courseIds: ["course-kalkulus-1"],
        topics: ["Turunan", "Integral Tentu"],
        hourlyRate: 40000,
        status: "pending",
      },
    },
  },
  {
    id: "tutor-applications-list",
    tag: "Courses & Tutors",
    folderSeq: 3,
    seq: 6,
    name: "Ambil Riwayat Pengajuan Tutor",
    method: "GET",
    pathTemplate: "/api/tutor-applications",
    openApiPath: "/api/tutor-applications",
    convexFunction: "tutors:listApplications (QUERY)",
    summary: "Ambil daftar pengajuan Jadi Tutor milik seorang user",
    description:
      "Menampilkan daftar pengajuan tutor berdasarkan query parameter `user_id`.",
    pathParams: [],
    queryParams: [
      {
        name: "user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID pengguna yang ingin dilihat riwayat pengajuannya",
      },
    ],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Riwayat pengajuan berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Data pengajuan tutor berhasil diambil.",
      data: [],
    },
  },

  // ============================================================================
  // 4. CHAT
  // ============================================================================
  {
    id: "conversations-list",
    tag: "Chat",
    folderSeq: 4,
    seq: 1,
    name: "Ambil Daftar Percakapan",
    method: "GET",
    pathTemplate: "/api/conversations",
    openApiPath: "/api/conversations",
    convexFunction: "chat:listConversations (QUERY)",
    summary: "Ambil daftar ruang chat milik user beserta unread count",
    description:
      "Mengambil seluruh percakapan di mana `user_id` terlibat sebagai mahasiswa maupun tutor, terurut dari pesan terbaru.",
    pathParams: [],
    queryParams: [
      {
        name: "user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID pengguna aktif (`user-learner-demo` atau `user-tutor-1`)",
      },
    ],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Daftar percakapan berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Daftar percakapan berhasil diambil.",
      data: [
        {
          conversation: {
            id: "conv-demo-seed-1",
            learnerId: "user-learner-demo",
            tutorId: "tutor-nadia",
            lastMessageAt: 1795503900000,
          },
          peerName: "Nadia Putri",
          peerRoleLabel: "Tutor",
          unreadCount: 1,
        },
      ],
    },
  },
  {
    id: "conversations-create",
    tag: "Chat",
    folderSeq: 4,
    seq: 2,
    name: "Buat atau Buka Percakapan",
    method: "POST",
    pathTemplate: "/api/conversations",
    openApiPath: "/api/conversations",
    convexFunction: "chat:getOrCreateConversation (MUTATION)",
    summary: "Buka ruang chat antara Mahasiswa dan Tutor",
    description:
      "Jika ruang chat antara `learner_id` dan `tutor_id` sudah ada, mengembalikan ruang chat tersebut. Jika belum ada, membuat ruang chat baru.",
    pathParams: [],
    queryParams: [],
    bodyFields: [
      {
        name: "learner_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID akun mahasiswa",
      },
      {
        name: "tutor_id",
        type: "string",
        required: true,
        defaultValue: "tutor-nadia",
        description: "ID profil tutor yang dihubungi",
      },
    ],
    defaultBody: {
      learner_id: "user-learner-demo",
      tutor_id: "tutor-nadia",
    },
    statusCodes: [
      { code: 200, when: "Ruang percakapan berhasil dibuka/dibuat" },
      { code: 400, when: "Tutor mencoba menghubungi dirinya sendiri (`SELF_CHAT_NOT_ALLOWED`)" },
      { code: 404, when: "Mahasiswa atau tutor tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Ruang percakapan siap.",
      data: {
        id: "conv-demo-seed-1",
        learnerId: "user-learner-demo",
        tutorId: "tutor-nadia",
        lastMessageAt: 1795503900000,
      },
    },
  },
  {
    id: "messages-list",
    tag: "Chat",
    folderSeq: 4,
    seq: 3,
    name: "Ambil Pesan Percakapan",
    method: "GET",
    pathTemplate: "/api/conversations/:conversation_id/messages",
    openApiPath: "/api/conversations/{conversation_id}/messages",
    convexFunction: "chat:listMessages (QUERY)",
    summary: "Ambil seluruh bubble pesan dalam satu ruang chat",
    description:
      "Mengambil daftar bubble pesan teks (`type = text`) dan kartu tawaran sesi (`type = offer`) secara kronologis.",
    pathParams: [
      {
        name: "conversation_id",
        type: "string",
        required: true,
        defaultValue: "conv-demo-seed-1",
        description: "ID ruang percakapan",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Daftar pesan berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Pesan percakapan berhasil diambil.",
      data: [
        {
          id: "msg-seed-1",
          conversationId: "conv-demo-seed-1",
          senderId: "user-learner-demo",
          type: "text",
          content:
            "Halo Kak Nadia, apakah bisa bantu bahas soal Integral Tentu untuk persiapan kuis minggu depan?",
          createdAt: 1795503600000,
          readAt: 1795503720000,
        },
        {
          id: "msg-seed-2",
          conversationId: "conv-demo-seed-1",
          senderId: "user-tutor-1",
          type: "text",
          content:
            "Halo Bima! Bisa banget. Kirim saja kisaran jadwal yang kosong nanti aku buatkan tawaran sesinya ya (pesan contoh demo).",
          createdAt: 1795503900000,
        },
      ],
    },
  },
  {
    id: "messages-send",
    tag: "Chat",
    folderSeq: 4,
    seq: 4,
    name: "Kirim Pesan Chat",
    method: "POST",
    pathTemplate: "/api/conversations/:conversation_id/messages",
    openApiPath: "/api/conversations/{conversation_id}/messages",
    convexFunction: "chat:sendMessage (MUTATION)",
    summary: "Kirim bubble pesan teks baru ke ruang chat",
    description:
      "Menambahkan bubble pesan baru ke dalam percakapan dan memperbarui `lastMessageAt`. Pengirim wajib merupakan peserta percakapan.",
    pathParams: [
      {
        name: "conversation_id",
        type: "string",
        required: true,
        defaultValue: "conv-demo-seed-1",
        description: "ID ruang percakapan",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "sender_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID akun pengirim (`user-learner-demo` atau `user-tutor-1`)",
      },
      {
        name: "content",
        type: "string",
        required: true,
        defaultValue: "Halo Kak Nadia, apakah Kamis pukul 19:00 WIB kosong?",
        description: "Isi teks pesan chat",
      },
    ],
    defaultBody: {
      sender_id: "user-learner-demo",
      content: "Halo Kak Nadia, apakah Kamis pukul 19:00 WIB kosong?",
    },
    statusCodes: [
      { code: 201, when: "Pesan berhasil dikirim" },
      { code: 400, when: "Pesan kosong atau pengirim bukan peserta percakapan" },
      { code: 404, when: "Percakapan tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Pesan berhasil dikirim.",
      data: {
        id: "msg-new-1",
        conversationId: "conv-demo-seed-1",
        senderId: "user-learner-demo",
        type: "text",
        content: "Halo Kak Nadia, apakah Kamis pukul 19:00 WIB kosong?",
        createdAt: 1795600000000,
      },
    },
  },
  {
    id: "messages-mark-read",
    tag: "Chat",
    folderSeq: 4,
    seq: 5,
    name: "Tandai Pesan Dibaca",
    method: "PATCH",
    pathTemplate: "/api/conversations/:conversation_id/read",
    openApiPath: "/api/conversations/{conversation_id}/read",
    convexFunction: "chat:markRead (MUTATION)",
    summary: "Tandai seluruh pesan lawan bicara sebagai sudah dibaca",
    description:
      "Memperbarui `readAt` pada semua pesan masuk di percakapan ini yang belum dibaca oleh `reader_id`.",
    pathParams: [
      {
        name: "conversation_id",
        type: "string",
        required: true,
        defaultValue: "conv-demo-seed-1",
        description: "ID ruang percakapan",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "reader_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID pengguna yang membuka ruang chat",
      },
    ],
    defaultBody: {
      reader_id: "user-learner-demo",
    },
    statusCodes: [{ code: 200, when: "Status baca berhasil diperbarui" }],
    exampleResponse: {
      success: true,
      message: "Seluruh pesan ditandai sudah dibaca.",
      data: { conversation_id: "conv-demo-seed-1", read: true },
    },
  },

  // ============================================================================
  // 5. BOOKINGS
  // ============================================================================
  {
    id: "bookings-create-offer",
    tag: "Bookings",
    folderSeq: 5,
    seq: 1,
    name: "Buat Tawaran Sesi",
    method: "POST",
    pathTemplate: "/api/conversations/:conversation_id/offers",
    openApiPath: "/api/conversations/{conversation_id}/offers",
    convexFunction: "bookings:createOffer (MUTATION)",
    summary: "Tutor membuat kartu tawaran sesi belajar di ruang chat",
    description:
      "Hanya tutor pada percakapan tersebut yang dapat membuat tawaran. Membuat record `bookings` (`status = offered`) dan mengirimkan kartu tawaran ke ruang chat.",
    pathParams: [
      {
        name: "conversation_id",
        type: "string",
        required: true,
        defaultValue: "conv-demo-seed-1",
        description: "ID ruang percakapan",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "actor_user_id",
        type: "string",
        required: true,
        defaultValue: "user-tutor-1",
        description: "ID user milik Tutor (`user-tutor-1`)",
      },
      {
        name: "course_id",
        type: "string",
        required: true,
        defaultValue: "course-kalkulus-1",
        description: "ID mata kuliah",
      },
      {
        name: "topic",
        type: "string",
        required: true,
        defaultValue: "Integral Tentu",
        description: "Subtopik bahasan",
      },
      {
        name: "start_at",
        type: "number",
        required: true,
        defaultValue: "1800000000000",
        description: "Timestamp jadwal mulai sesi (epoch ms di waktu mendatang)",
      },
      {
        name: "price",
        type: "number",
        required: true,
        defaultValue: "45000",
        description: "Tarif sesi 60 menit dalam Rupiah",
      },
      {
        name: "meeting_mode",
        type: "string",
        required: false,
        defaultValue: "online",
        description: "`online` atau `offline_its` (Tatap muka di kampus ITS)",
      },
      {
        name: "brief",
        type: "string",
        required: false,
        defaultValue:
          "Bahas latihan soal Integral Tentu dan Teorema Fundamental Kalkulus.",
        description: "Catatan persiapan sesi / Pre-Session Brief",
      },
    ],
    defaultBody: {
      actor_user_id: "user-tutor-1",
      course_id: "course-kalkulus-1",
      topic: "Integral Tentu",
      start_at: 1800000000000,
      price: 45000,
      meeting_mode: "online",
      brief:
        "Bahas latihan soal Integral Tentu dan Teorema Fundamental Kalkulus.",
    },
    statusCodes: [
      { code: 201, when: "Kartu tawaran sesi berhasil dibuat" },
      { code: 400, when: "Jadwal sudah lewat atau actor bukan tutor percakapan" },
      { code: 404, when: "Percakapan atau mata kuliah tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Tawaran sesi berhasil dikirim ke ruang chat.",
      data: {
        id: "bk-demo-1",
        conversationId: "conv-demo-seed-1",
        learnerId: "user-learner-demo",
        tutorId: "tutor-nadia",
        courseId: "course-kalkulus-1",
        topic: "Integral Tentu",
        startAt: 1800000000000,
        durationMinutes: 60,
        price: 45000,
        meetingMode: "online",
        status: "offered",
      },
    },
  },
  {
    id: "bookings-detail",
    tag: "Bookings",
    folderSeq: 5,
    seq: 2,
    name: "Ambil Detail Booking",
    method: "GET",
    pathTemplate: "/api/bookings/:booking_id",
    openApiPath: "/api/bookings/{booking_id}",
    convexFunction: "bookings:getBookingById (QUERY)",
    summary: "Ambil informasi detail satu booking sesi",
    description: "Mengambil data booking berdasarkan `booking_id`.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking dari hasil pembuatan tawaran sesi",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "Data booking ditemukan" },
      { code: 404, when: "Booking tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Data booking berhasil diambil.",
      data: {
        id: "bk-demo-1",
        conversationId: "conv-demo-seed-1",
        learnerId: "user-learner-demo",
        tutorId: "tutor-nadia",
        courseId: "course-kalkulus-1",
        topic: "Integral Tentu",
        startAt: 1800000000000,
        durationMinutes: 60,
        price: 45000,
        meetingMode: "online",
        status: "offered",
      },
    },
  },
  {
    id: "bookings-accept",
    tag: "Bookings",
    folderSeq: 5,
    seq: 3,
    name: "Terima Tawaran Sesi",
    method: "PATCH",
    pathTemplate: "/api/bookings/:booking_id/accept",
    openApiPath: "/api/bookings/{booking_id}/accept",
    convexFunction: "bookings:acceptOffer (MUTATION)",
    summary: "Mahasiswa menerima tawaran sesi (Validasi Anti-Bentrok Jadwal)",
    description:
      "Menjalankan transaksi ACID di Convex: memastikan jadwal belum kedaluwarsa (`OFFER_EXPIRED`), mengecek tidak ada sesi aktif lain milik tutor pada rentang 60 menit yang sama (`SCHEDULE_CONFLICT`), mengubah status menjadi `accepted`, dan membuat tagihan `unpaid`.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking tawaran sesi",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "actor_user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID akun mahasiswa penerima tawaran",
      },
    ],
    defaultBody: {
      actor_user_id: "user-learner-demo",
    },
    statusCodes: [
      { code: 200, when: "Tawaran sesi berhasil diterima (`status = accepted`)" },
      { code: 400, when: "Jadwal sudah lewat atau pemanggil bukan mahasiswa" },
      { code: 409, when: "Jadwal bentrok (`SCHEDULE_CONFLICT`) atau sudah diterima/ditolak" },
    ],
    exampleResponse: {
      success: true,
      message: "Tawaran sesi berhasil diterima. Silakan lanjutkan ke pembayaran.",
      data: {
        id: "bk-demo-1",
        status: "accepted",
      },
    },
  },
  {
    id: "bookings-decline",
    tag: "Bookings",
    folderSeq: 5,
    seq: 4,
    name: "Tolak Tawaran Sesi",
    method: "PATCH",
    pathTemplate: "/api/bookings/:booking_id/decline",
    openApiPath: "/api/bookings/{booking_id}/decline",
    convexFunction: "bookings:declineOffer (MUTATION)",
    summary: "Mahasiswa menolak tawaran sesi",
    description:
      "Mengubah status tawaran sesi dari `offered` menjadi `declined`.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking tawaran sesi",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "actor_user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID akun mahasiswa penerima tawaran",
      },
    ],
    defaultBody: {
      actor_user_id: "user-learner-demo",
    },
    statusCodes: [
      { code: 200, when: "Tawaran sesi berhasil ditolak" },
      { code: 409, when: "Tawaran sudah tidak dalam status `offered`" },
    ],
    exampleResponse: {
      success: true,
      message: "Tawaran sesi telah ditolak.",
      data: {
        id: "bk-demo-1",
        status: "declined",
      },
    },
  },

  // ============================================================================
  // 6. PAYMENTS (QRIS)
  // ============================================================================
  {
    id: "payments-checkout-detail",
    tag: "Payments",
    folderSeq: 6,
    seq: 1,
    name: "Ambil Ringkasan Checkout",
    method: "GET",
    pathTemplate: "/api/bookings/:booking_id/checkout",
    openApiPath: "/api/bookings/{booking_id}/checkout",
    convexFunction: "payments:getCheckoutByBooking (QUERY)",
    summary:
      "Ambil data halaman Pembayaran (/pembayaran/[id]): Nama tutor, matkul, harga, status QRIS",
    description:
      "Mengambil data gabungan `booking`, `payment`, `tutor`, `learner`, dan `course` untuk ditampilkan di layar checkout QRIS.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking yang akan dibayar",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "Data checkout berhasil diambil" },
      { code: 404, when: "Booking tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Data checkout berhasil diambil.",
      data: {
        booking: {
          id: "bk-demo-1",
          topic: "Integral Tentu",
          price: 45000,
          status: "accepted",
        },
        payment: {
          id: "pay-bk-demo-1",
          bookingId: "bk-demo-1",
          amount: 45000,
          status: "unpaid",
        },
        tutor: {
          id: "tutor-nadia",
          name: "Nadia Putri",
        },
        course: {
          id: "course-kalkulus-1",
          name: "Kalkulus 1",
        },
      },
    },
  },
  {
    id: "payments-start",
    tag: "Payments",
    folderSeq: 6,
    seq: 2,
    name: "Mulai Pembayaran QRIS",
    method: "POST",
    pathTemplate: "/api/bookings/:booking_id/payment/start",
    openApiPath: "/api/bookings/{booking_id}/payment/start",
    convexFunction: "payments:startPayment (MUTATION)",
    summary: "Aktifkan panel QRIS saat mahasiswa menekan tombol Bayar",
    description:
      "Memastikan sesi sudah berstatus `accepted` dan belum lunas (`ALREADY_PAID`), lalu menyiapkan data pembayaran QRIS.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking yang dibayar",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "actor_user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID mahasiswa pemesan",
      },
    ],
    defaultBody: {
      actor_user_id: "user-learner-demo",
    },
    statusCodes: [
      { code: 200, when: "Panel QRIS siap ditampilkan" },
      { code: 409, when: "Sesi belum diterima (`NOT_ACCEPTED`) atau sudah lunas (`ALREADY_PAID`)" },
    ],
    exampleResponse: {
      success: true,
      message: "Silakan lakukan pembayaran melalui QRIS.",
      data: {
        id: "pay-bk-demo-1",
        bookingId: "bk-demo-1",
        amount: 45000,
        status: "unpaid",
      },
    },
  },
  {
    id: "payments-submit-proof",
    tag: "Payments",
    folderSeq: 6,
    seq: 3,
    name: "Kirim Bukti Pembayaran",
    method: "POST",
    pathTemplate: "/api/bookings/:booking_id/payment/proof",
    openApiPath: "/api/bookings/{booking_id}/payment/proof",
    convexFunction: "payments:submitDemoProof (MUTATION)",
    summary: "Unggah bukti pembayaran QRIS (ubah status ke pending_verification)",
    description:
      "Mencatat bukti pembayaran QRIS dari mahasiswa dan mengubah status pembayaran menjadi `pending_verification` untuk diperiksa admin.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "actor_user_id",
        type: "string",
        required: true,
        defaultValue: "user-learner-demo",
        description: "ID mahasiswa pemesan",
      },
      {
        name: "proof_name",
        type: "string",
        required: false,
        defaultValue: "bukti-qris-bima.jpg",
        description: "Nama file bukti transfer QRIS",
      },
    ],
    defaultBody: {
      actor_user_id: "user-learner-demo",
      proof_name: "bukti-qris-bima.jpg",
    },
    statusCodes: [
      { code: 200, when: "Bukti pembayaran berhasil dikirim (`pending_verification`)" },
      { code: 409, when: "Bukti sudah pernah dikirim atau pembayaran sudah lunas" },
    ],
    exampleResponse: {
      success: true,
      message: "Bukti pembayaran berhasil dikirim dan menunggu verifikasi.",
      data: {
        id: "pay-bk-demo-1",
        bookingId: "bk-demo-1",
        amount: 45000,
        status: "pending_verification",
        proofName: "bukti-qris-bima.jpg",
      },
    },
  },
  {
    id: "payments-decide",
    tag: "Payments",
    folderSeq: 6,
    seq: 4,
    name: "Putuskan Pembayaran",
    method: "PATCH",
    pathTemplate: "/api/bookings/:booking_id/payment/status",
    openApiPath: "/api/bookings/{booking_id}/payment/status",
    convexFunction: "payments:simulateVerification (MUTATION)",
    summary: "Setujui atau tolak bukti pembayaran QRIS (memicu Pop-up Success)",
    description:
      "Memutuskan bukti pembayaran yang berstatus `pending_verification`. Saat `decision = approve`, status `payment` dan `booking` berubah menjadi `paid` dan memunculkan Pop-up Success di sisi mahasiswa.",
    pathParams: [
      {
        name: "booking_id",
        type: "string",
        required: true,
        defaultValue: "bk-demo-1",
        description: "ID booking",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "decision",
        type: "string",
        required: true,
        defaultValue: "approve",
        description: "`approve` (setujui & lunas) atau `reject` (tolak bukti)",
      },
    ],
    defaultBody: {
      decision: "approve",
    },
    statusCodes: [
      { code: 200, when: "Status pembayaran berhasil diperbarui" },
      { code: 409, when: "Pembayaran tidak sedang dalam status `pending_verification`" },
    ],
    exampleResponse: {
      success: true,
      message: "Status pembayaran berhasil diperbarui.",
      data: {
        id: "pay-bk-demo-1",
        bookingId: "bk-demo-1",
        amount: 45000,
        status: "paid",
      },
    },
  },

  // ============================================================================
  // 7. ADMIN
  // ============================================================================
  {
    id: "admin-metrics",
    tag: "Admin",
    folderSeq: 7,
    seq: 1,
    name: "Ambil Ringkasan Metrik Pilot",
    method: "GET",
    pathTemplate: "/api/admin/metrics",
    openApiPath: "/api/admin/metrics",
    convexFunction: "metrics:getPilotMetrics (QUERY)",
    summary: "Ambil ringkasan statistik & metrik pilot (Bab 6.1 Brief)",
    description:
      "Mengekstrak metrik pilot secara otomatis dari database Convex: jumlah user, tutor terverifikasi, tingkat penerimaan tawaran (%), tingkat penyelesaian pembayaran (%), rata-rata rating tutor, dan total pendapatan.",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Ringkasan metrik berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Ringkasan metrik pilot berhasil diambil.",
      data: {
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
  },
  {
    id: "admin-pending-tutors",
    tag: "Admin",
    folderSeq: 7,
    seq: 2,
    name: "Ambil Antrean Pengajuan Tutor",
    method: "GET",
    pathTemplate: "/api/admin/tutor-applications",
    openApiPath: "/api/admin/tutor-applications",
    convexFunction: "admin:listPendingApplications (QUERY)",
    summary: "Ambil daftar pengajuan Jadi Tutor yang menunggu verifikasi",
    description:
      "Menampilkan seluruh pengajuan di tabel `tutorApplications` yang masih berstatus `pending`.",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Antrean pengajuan tutor berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Antrean pengajuan tutor berhasil diambil.",
      data: [],
    },
  },
  {
    id: "admin-approve-tutor",
    tag: "Admin",
    folderSeq: 7,
    seq: 3,
    name: "Setujui Pengajuan Tutor",
    method: "PATCH",
    pathTemplate: "/api/admin/tutor-applications/:application_id/approve",
    openApiPath: "/api/admin/tutor-applications/{application_id}/approve",
    convexFunction: "admin:approveTutorApplication (MUTATION)",
    summary: "Verifikasi & aktifkan calon tutor agar tampil di halaman Cari Tutor",
    description:
      "Menyetujui pendaftaran tutor, memberikan lencana verifikasi (`grade` atau `asdos`), dan memindahkan data ke tabel `tutors` dengan `verified = true`.",
    pathParams: [
      {
        name: "application_id",
        type: "string",
        required: true,
        defaultValue: "app-tutor-demo",
        description: "ID pengajuan tutor dari antrean",
      },
    ],
    queryParams: [],
    bodyFields: [
      {
        name: "department",
        type: "string",
        required: false,
        defaultValue: "Teknik Informatika",
        description: "Departemen ITS tutor",
      },
      {
        name: "cohort",
        type: "number",
        required: false,
        defaultValue: "2023",
        description: "Angkatan tutor",
      },
      {
        name: "badge",
        type: "string",
        required: false,
        defaultValue: "grade",
        description: "Lencana verifikasi: `grade` (Nilai A/AB) atau `asdos`",
      },
    ],
    defaultBody: {
      department: "Teknik Informatika",
      cohort: 2023,
      badge: "grade",
    },
    statusCodes: [
      { code: 200, when: "Tutor berhasil diverifikasi dan aktif di `/cari`" },
      { code: 404, when: "ID pengajuan tutor tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Pengajuan tutor disetujui dan profil tutor telah aktif.",
      data: {
        id: "tutor-bima-pratama",
        name: "Bima Pratama",
        verified: true,
        badge: "grade",
      },
    },
  },
  {
    id: "admin-reject-tutor",
    tag: "Admin",
    folderSeq: 7,
    seq: 4,
    name: "Hapus / Tolak Pengajuan Tutor",
    method: "DELETE",
    pathTemplate: "/api/admin/tutor-applications/:application_id",
    openApiPath: "/api/admin/tutor-applications/{application_id}",
    convexFunction: "admin:rejectTutorApplication (MUTATION)",
    summary: "Tolak dan hapus pengajuan Jadi Tutor dari antrean",
    description:
      "Menghapus pengajuan tutor berstatus `pending` yang tidak memenuhi syarat verifikasi.",
    pathParams: [
      {
        name: "application_id",
        type: "string",
        required: true,
        defaultValue: "app-tutor-demo",
        description: "ID pengajuan tutor yang ditolak",
      },
    ],
    queryParams: [],
    bodyFields: [],
    statusCodes: [
      { code: 200, when: "Pengajuan berhasil dihapus" },
      { code: 404, when: "Pengajuan tidak ditemukan" },
    ],
    exampleResponse: {
      success: true,
      message: "Pengajuan tutor telah ditolak dan dihapus dari antrean.",
      data: { rejected: true },
    },
  },
  {
    id: "admin-pending-payments",
    tag: "Admin",
    folderSeq: 7,
    seq: 5,
    name: "Ambil Antrean Pembayaran",
    method: "GET",
    pathTemplate: "/api/admin/payments",
    openApiPath: "/api/admin/payments",
    convexFunction: "admin:listPendingPayments (QUERY)",
    summary: "Ambil daftar pembayaran QRIS yang menunggu verifikasi admin",
    description:
      "Menampilkan seluruh transaksi di tabel `payments` dengan status `pending_verification`.",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    statusCodes: [{ code: 200, when: "Antrean pembayaran berhasil diambil" }],
    exampleResponse: {
      success: true,
      message: "Antrean pembayaran berhasil diambil.",
      data: [],
    },
  },
  {
    id: "admin-reset-demo",
    tag: "Admin",
    folderSeq: 7,
    seq: 6,
    name: "Reset Data Demo",
    method: "POST",
    pathTemplate: "/api/demo/reset",
    openApiPath: "/api/demo/reset",
    convexFunction: "seed:resetDemoData (MUTATION)",
    summary: "Reset seluruh database kembali ke seed data awal",
    description:
      "Menghapus data percobaan dan memuat ulang data awal (2 mata kuliah, 5 tutor ITS terverifikasi, 6 akun demo, dan 1 ruang chat contoh).",
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    defaultBody: {},
    statusCodes: [{ code: 200, when: "Data demo berhasil direset" }],
    exampleResponse: {
      success: true,
      message: "Seluruh data demo berhasil direset ke kondisi awal.",
      data: { reset: true },
    },
  },
];

export function buildOpenApiSpec(baseUrl = "http://localhost:3000") {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of REST_ENDPOINTS_CATALOG) {
    if (!paths[ep.openApiPath]) {
      paths[ep.openApiPath] = {};
    }

    const parameters: Array<Record<string, unknown>> = [];
    for (const p of ep.pathParams) {
      parameters.push({
        name: p.name,
        in: "path",
        required: true,
        description: p.description,
        schema: { type: "string", default: p.defaultValue },
      });
    }
    for (const q of ep.queryParams) {
      parameters.push({
        name: q.name,
        in: "query",
        required: q.required,
        description: q.description,
        schema: {
          type: q.type === "number" ? "number" : "string",
          ...(q.defaultValue ? { default: q.defaultValue } : {}),
        },
      });
    }

    const operation: Record<string, unknown> = {
      tags: [ep.tag],
      operationId: ep.id,
      summary: ep.name,
      description: `${ep.summary}\n\n${ep.description}\n\n**Convex Handler:** \`${ep.convexFunction}\``,
      ...(parameters.length > 0 ? { parameters } : {}),
      responses: Object.fromEntries(
        ep.statusCodes.map((sc) => [
          String(sc.code),
          {
            description: sc.when,
            ...(sc.code >= 200 && sc.code < 300
              ? {
                  content: {
                    "application/json": {
                      example: ep.exampleResponse,
                    },
                  },
                }
              : {}),
          },
        ])
      ),
    };

    if (
      (ep.method === "POST" || ep.method === "PATCH") &&
      ep.bodyFields.length > 0
    ) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const f of ep.bodyFields) {
        properties[f.name] = {
          type:
            f.type === "number"
              ? "number"
              : f.type.endsWith("[]")
                ? "array"
                : "string",
          description: f.description,
        };
        if (f.required) required.push(f.name);
      }

      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties,
              ...(required.length > 0 ? { required } : {}),
            },
            example: ep.defaultBody ?? {},
          },
        },
      };
    }

    paths[ep.openApiPath][ep.method.toLowerCase()] = operation;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "KOLEARA API Docs",
      version: "1.0.0",
      description:
        "Dokumentasi REST API (`GET`, `POST`, `PATCH`, `DELETE`) & Convex Backend untuk platform Peer Tutoring Mahasiswa ITS (KOLEARA).",
    },
    servers: [
      {
        url: baseUrl,
        description: "Local / Development Server",
      },
    ],
    tags: [
      { name: "Health", description: "Pemeriksaan status server & database" },
      {
        name: "Auth",
        description:
          "Autentikasi OTP email mahasiswa ITS (`NRP@student.its.ac.id`) & data user",
      },
      {
        name: "Courses & Tutors",
        description:
          "Mata kuliah, pencarian tutor dengan Explainable Matching Score (Bab 4.7), detail profil tutor, dan pendaftaran Jadi Tutor",
      },
      {
        name: "Chat",
        description: "Percakapan mahasiswa & tutor serta pengiriman pesan chat",
      },
      {
        name: "Bookings",
        description:
          "Pembuatan tawaran sesi di chat serta terima/tolak tawaran dengan validasi anti-bentrok jadwal",
      },
      {
        name: "Payments",
        description:
          "Ringkasan checkout, pembayaran QRIS, unggah bukti, dan keputusan verifikasi pembayaran",
      },
      {
        name: "Admin",
        description:
          "Metrik pilot Bab 6.1, verifikasi pendaftaran tutor, antrean pembayaran, dan reset data demo",
      },
    ],
    paths,
  };
}
