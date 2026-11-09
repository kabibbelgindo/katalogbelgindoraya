============================================================
KATALOG PRODUK PT. BELGINDO RAYA — Aplikasi Katalog Digital
Versi 1.1 — 9 November 2026
============================================================

ISI PAKET
- src/                 kode aplikasi (Next.js + TypeScript)
- prisma/              skema database (sudah diatur untuk PostgreSQL)
- upload/foto_extracted/  foto contoh untuk skrip seed
- scripts/seed.ts      penyiapan akun admin + data awal
- .env.example         contoh konfigurasi (salin menjadi .env)
- .env.local           konfigurasi Firebase untuk login admin (publik, jangan diubah)
- docs/                Panduan Instalasi lengkap (DOCX + PDF)

CARA CEPAT (ringkasan — ikuti docs/Panduan_Instalasi... untuk lengkapnya)
1. Pasang Node.js 20+, Bun, dan PostgreSQL 14+ di PC server.
2. Buat database: CREATE USER belgindo_admin WITH PASSWORD '...';
   CREATE DATABASE belgindo_katalog OWNER belgindo_admin;
3. Salin folder proyek ini ke mis. C:\katalog-belgindo, lalu salin
   .env.example menjadi .env dan isi DATABASE_URL + AUTH_SECRET.
4. Di folder proyek jalankan:
      npm install
      npx prisma db push
      bun scripts/seed.ts
      npm run build
      npm run start
5. Buka http://localhost:3000 — dari PC karyawan: http://<ip-server>:3000
   (buka port 3000 pada firewall server).

AKUN ADMIN AWAL
   Email    : admin@belgindo.co.id
   Password : belgindo2026
   Segera ganti setelah instalasi (lihat Panduan Bab 8).

LOGIN FIREBASE (opsional, disarankan)
   Buat akun admin di Firebase Console — Authentication — Users
   (email SAMA dengan admin katalog). Detail: Panduan Bab 9.
   Tanpa Firebase, tombol Masuk tetap berfungsi lewat login lokal.

CATATAN
- Foto produk tersimpan di folder db/uploads (dibuat saat berjalan) —
  wajib ikut dicadangkan (Panduan Bab 11).
- Karyawan membaca katalog tanpa login; 1 admin mengelola lewat
  kolom login di header pojok kanan atas.
