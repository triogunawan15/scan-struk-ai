# Scan Struk AI — Panduan Setup dari Huawei MatePad 11.5

Semua langkah di bawah pakai **browser** (Chrome/HMS Browser) di tablet kamu —
tidak perlu install Node.js atau buka terminal sama sekali. Yang dipakai:
GitHub (simpan kode), Vercel (hosting + jalankan API), Supabase (database +
login user), Anthropic Console (AI).

## Arsitektur singkat

```
Tablet (browser) → Next.js App (Vercel)
                      ├─ Halaman utama: foto struk, login, edit hasil
                      └─ /api/scan (server, TERSEMBUNYI dari user)
                            ├─ cek kuota user di Supabase
                            ├─ panggil Anthropic API pakai API key rahasia
                            └─ balikin hasil bacaan ke tablet
                  ↕
              Supabase (Postgres + Auth)
                  - tabel profiles: plan (free/paid), scan_count
                  - tabel receipts: hasil pembukuan
```

API key Anthropic **hanya hidup di server Vercel**, tidak pernah dikirim ke
HP/tablet pengguna — jadi tidak bisa dicuri lewat inspect element.

## Langkah 1 — Buat akun & API key

1. **Anthropic**: buka console.anthropic.com dari browser tablet → daftar/login
   → menu "API Keys" → buat key baru, copy dan simpan sementara (nanti
   dipakai di Vercel).
2. **Supabase**: buka supabase.com → daftar/login → "New Project" → kasih
   nama, pilih region Singapore (paling dekat), catat password database.
3. **GitHub**: buka github.com → daftar/login kalau belum punya.
4. **Vercel**: buka vercel.com → daftar pakai akun GitHub (biar auto-connect).

## Langkah 2 — Siapkan database Supabase

1. Di dashboard project Supabase → menu **SQL Editor** (ikon di sidebar kiri)
   → **New query**.
2. Buka file `supabase/schema.sql` dari project ini, salin semua isinya,
   tempel ke SQL Editor, lalu tekan **Run**.
3. Cek di menu **Table Editor** — harus muncul 2 tabel: `profiles` dan
   `receipts`.
4. Ambil kredensial: menu **Project Settings > API** → catat:
   - `Project URL` → ini `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ini `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (klik "reveal") → ini `SUPABASE_SERVICE_ROLE_KEY`
     (JANGA pernah dibagikan/dipakai di kode frontend, ini kunci sakti admin)

## Langkah 3 — Upload kode ke GitHub

1. Di github.com, tekan tombol **+** → **New repository** → nama misalnya
   `scan-struk-ai` → Create repository.
2. Di halaman repo kosong, pilih **"uploading an existing file"**.
3. Dari file manager tablet, extract folder project ini, lalu drag semua
   file & folder (app, lib, supabase, package.json, dst) ke area upload
   GitHub. Kalau drag-folder tidak didukung browsernya, upload satu-satu
   folder (app/, lib/, supabase/) lewat tombol "Add file > Upload files"
   di masing-masing subfolder.
4. Commit langsung ke branch `main`.

## Langkah 4 — Deploy ke Vercel

1. Di vercel.com dashboard → **Add New > Project** → pilih repo
   `scan-struk-ai` yang baru dibuat → **Import**.
2. Sebelum klik Deploy, buka bagian **Environment Variables**, isi 4 baris
   ini (nilainya dari Langkah 1 & 2):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
3. Klik **Deploy**. Tunggu 1-2 menit → Vercel kasih link seperti
   `scan-struk-ai.vercel.app` — buka di tablet, itu sudah jadi aplikasinya.

## Langkah 5 — Aktifkan login email di Supabase

1. Di Supabase dashboard → **Authentication > URL Configuration** → isi
   `Site URL` dengan link Vercel kamu (`https://scan-struk-ai.vercel.app`).
2. Menu **Authentication > Providers** → pastikan **Email** aktif (biasanya
   sudah default aktif dengan magic link).
3. Coba buka aplikasi → masukkan email → cek inbox → klik link login.

## Langkah 6 — Coba alur lengkap

1. Login pakai email.
2. Tekan tombol **📷 Foto Struk** → kamera/tablet akan minta foto atau pilih
   dari galeri.
3. Tunggu beberapa detik → hasil bacaan AI (nama toko, tanggal, total,
   kategori) muncul untuk dicek/edit.
4. Tekan **Simpan ke Pembukuan** → data masuk ke tabel `receipts`.
5. Cek angka kuota di pojok kanan atas (misal `1/20 scan bulan ini`).

## Cara kerja jatah gratis vs berbayar

- Tabel `profiles.plan` defaultnya `'free'`, batas 20 scan/bulan (dihitung
  otomatis di `/api/scan`, reset tiap tanggal 1).
- Untuk MVP, cara paling cepat upgrade user ke Bisnis: buka Supabase **Table
  Editor > profiles**, cari user-nya, ubah kolom `plan` jadi `'paid'` secara
  manual (misal setelah mereka transfer/bayar lewat WhatsApp).
- Kalau bisnisnya sudah jalan dan mau otomatis, langkah selanjutnya adalah
  integrasi payment gateway lokal (Midtrans/Xendit Snap) yang begitu
  pembayaran sukses, webhook-nya update `plan` jadi `'paid'` otomatis — ini
  bisa dibangun di iterasi berikutnya begitu produknya sudah divalidasi ada
  yang mau bayar.

## Kalau mau develop/edit kode lanjutan dari tablet

Karena tidak ada terminal Node.js di tablet, cara paling praktis edit kode
tanpa laptop:
- Edit langsung file di **github.dev** — buka repo kamu di GitHub, tekan
  tombol `.` (titik) di keyboard atau ganti `github.com` jadi `github.dev`
  di address bar → jadi editor kode lengkap di browser.
- Tiap kamu commit perubahan, Vercel otomatis re-deploy dalam ~1 menit.
