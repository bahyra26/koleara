# KOLEARA — Prototipe Frontend Peer Tutoring ITS

Prototipe **frontend-only** low-fidelity (grayscale) untuk **KOLEARA**, marketplace peer tutoring mahasiswa ITS (cakupan MVP: **Kalkulus 1** dan **Fisika Dasar 1**).

Seluruh alur berjalan lokal menggunakan data sintetik dan penyimpanan `localStorage` (`koleara-demo-v1`) tanpa backend, Convex, database, pengiriman OTP nyata, chat server real-time, maupun payment gateway.

---

## Cara Menjalankan

Proyek ini menggunakan **pnpm** dan **Next.js App Router**:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000).

Perintah verifikasi:

```bash
node --import ./tests/register-alias.mjs --test tests/core.test.mts
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

---

## Peta Rute

| Rute | Fungsi |
|---|---|
| `/` | Landing page dengan CTA `Cari Tutor`, `Jadi Tutor`, dan ringkasan mata kuliah |
| `/signup`, `/login` | Validasi email ITS (`/^\d{10}@student\.its\.ac\.id$/`), OTP demo `123456`, dan sesi demo |
| `/cari` | Pencarian & filter tutor (kata kunci, mata kuliah, topik, anggaran, jadwal) + skor kecocokan lokal |
| `/tutor/[id]` | Profil detail tutor, jadwal ketersediaan, dan tombol `Hubungi Tutor` |
| `/chat`, `/chat/[id]` | Daftar percakapan, bubble pesan, panel ganti peran demo, kartu tawaran sesi & terima/tolak |
| `/pembayaran/[id]` | Ringkasan booking, placeholder non-payable `QRIS DEMO — JANGAN TRANSFER`, bukti demo, simulasi verifikasi admin, dan modal sukses |
| `/jadi-tutor` | Formulir pengajuan tutor singkat (tersimpan dengan status `pending`, tidak self-verify) |

---

## Akun Demo Sintetik

Gunakan kode OTP demo **`123456`** untuk semua proses masuk/daftar demo. Tidak ada email yang dikirim dan tidak ada password yang disimpan.

| Peran | Nama | Email ITS Sintetik |
|---|---|---|
| Mahasiswa (Default) | Bima Pratama | `0000000001@student.its.ac.id` |
| Tutor — Kalkulus 1 | Nadia Putri | `0000000101@student.its.ac.id` |
| Tutor — Fisika Dasar 1 | Raka Wijaya | `0000000102@student.its.ac.id` |
| Tutor — Kalkulus 1 & Fisika Dasar 1 | Salsa Rahmadhani | `0000000103@student.its.ac.id` |
| Tutor — Fisika Dasar 1 & Kalkulus 1 | Dimas Santoso | `0000000104@student.its.ac.id` |
| Tutor — Kalkulus 1 | Alya Kusuma | `0000000105@student.its.ac.id` |

Anda juga dapat mendaftar akun mahasiswa demo baru di `/signup` menggunakan format 10 digit NRP + `@student.its.ac.id` (misalnya `0000000099@student.its.ac.id`).

---

## Panduan Uji Coba (Walkthrough)

1. Buka `/` lalu klik **Cari Tutor**; ketik `Integral` dan pilih batas anggaran (misalnya `≤ Rp45rb` atau `50000`).
2. Buka salah satu profil tutor (`/tutor/tutor-nadia`), klik **Hubungi Tutor**, daftar di `/signup` dengan email ITS sintetik dan OTP demo `123456` (Anda kembali ke `/tutor/tutor-nadia`), lalu klik **Hubungi Tutor** untuk membuka ruang chat.
3. Kirim pesan teks dari sisi mahasiswa. Gunakan tombol **Beralih ke Tutor (...)** di header chat, kirim balasan, lalu klik **+ Buat Tawaran Sesi** dan kirim tawaran jadwal mendatang (WIB).
4. Klik **Beralih ke Mahasiswa (...)**, klik **Terima Tawaran**, lalu klik **Lanjut ke Pembayaran** dan pastikan nominal cocok dengan tawaran.
5. Di `/pembayaran/[id]`, klik **Bayar** untuk melihat placeholder **QRIS DEMO — JANGAN TRANSFER**, masukkan/pilih nama file bukti demo, lalu klik **Kirim Bukti Pembayaran (Demo)** (status berubah ke `pending_verification`, belum lunas).
6. Klik **Simulasikan verifikasi admin** (atau uji **Simulasikan verifikasi ditolak** terlebih dahulu untuk menguji alur coba ulang). Saat disetujui, modal sukses muncul; klik **Kembali ke Chat** lalu muat ulang browser — status pembayaran tetap `paid`.
7. Klik **Jadi Tutor** di header, lengkapi formulir, kirim pengajuan, dan pastikan statusnya **Menunggu Verifikasi (Pending)** serta tidak otomatis muncul di `/cari`.
8. Klik **Reset Demo** di banner atas untuk mengembalikan seluruh data ke kondisi awal.

---

## Reset Data Demo

- Klik tombol **Reset Demo** → **Ya, Reset** pada banner `Mode Demo — Frontend Prototype` di bagian atas halaman.
- Aksi ini hanya menghapus kunci `localStorage` milik aplikasi (`koleara-demo-v1`) dan memuat ulang data seed awal.

---

## Batasan Prototipe (Di Luar Cakupan)

- **Tidak ada backend / Convex / database / API route**: seluruh state disimpan di memori & `localStorage` browser lokal (sinkronisasi antar tab hanya pada browser/origin yang sama via `storage` event & `BroadcastChannel`).
- **Autentikasi simulasi**: validasi regex email ITS dan OTP `123456` hanya simulasi UX; tidak membuktikan keanggotaan ITS atau kepemilikan email.
- **Pembayaran simulasi**: placeholder QRIS sengaja tidak dapat dipindai (`QRIS DEMO — JANGAN TRANSFER`), tidak ada payment gateway, dan file bukti tidak pernah diunggah atau disimpan byte-nya (hanya nama file).
- **Heuristik pencocokan lokal**: skor kecocokan pada `/cari` dihitung secara deterministik dari kecocokan topik, badge/rating contoh, anggaran, dan jadwal — bukan AI.
- **UI Grayscale sementara**: komponen dan token warna dibuat netral (`app/globals.css`, `components/ui/`) agar mudah disesuaikan saat desain Figma final tersedia.
