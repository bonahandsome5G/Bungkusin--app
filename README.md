# Bungkus! — Web App Food Rescue

Web app untuk proyek Venture Creation LS01: mempertemukan makanan berlebih dari restoran, kafe, bakery, dan UMKM dengan pembeli di sekitarnya, 50–70% lebih murah.

Stack: **React + Vite + TypeScript + Tailwind CSS**, database **Supabase** (Postgres, Auth, Storage, Realtime), peta **Leaflet + OpenStreetMap**.

## Fitur

**Pembeli**
- Pencarian berbasis lokasi (GPS atau titik kampus), jarak dihitung otomatis, tampilan daftar dan peta
- Filter kategori makanan, jarak (1/3/5 km), harga, dan urutan (terdekat, segera tutup, termurah, diskon terbesar)
- Notifikasi real-time saat ada stok baru dalam 5 km atau dari toko favorit (plus notifikasi browser)
- Pemesanan + pembayaran (GoPay/OVO/DANA/QRIS/debit, masih simulasi), ambil sendiri atau antar kurir
- Kode pengambilan unik `BGS-XXXX` untuk ditunjukkan ke kasir, bisa dibatalkan sebelum jam ambil
- Rating & ulasan setelah pesanan diambil, toko favorit
- Halaman dampak: porsi diselamatkan, uang dihemat, perkiraan kg makanan dan CO₂e

**Mitra restoran**
- Dashboard upload stok: foto, harga normal vs harga Bungkus!, jumlah porsi, jam ambil, alergen
- Cek kelayakan wajib sebelum tayang (menjawab feedback “bagaimana menjamin kualitas makanan”)
- Verifikasi kode pembeli di kasir
- Jadwal stok rutin (mis. Senin–Jumat 20.00–21.00), terbit dengan satu klik atau otomatis via `pg_cron`
- Laporan penjualan 7/30 hari: porsi diselamatkan, penjualan kotor, komisi 10%, pendapatan bersih, menu terlaris
- Pengaturan toko dengan titik lokasi di peta

## Menjalankan

Butuh [Node.js 18+](https://nodejs.org).

```bash
npm install
npm run dev
```

Buka alamat yang muncul (biasanya http://localhost:5173).

> `index.html` adalah kode sumber, jadi kalau dibuka langsung dengan dobel-klik hanya muncul petunjuk. Untuk mencoba tanpa terminal, buka **`bungkus-standalone.html`**: seluruh aplikasi dalam satu file (mode demo). Buat ulang file itu setelah mengubah kode dengan `npm run build:standalone`.

### Mode demo (tanpa Supabase)

Kalau file `.env` belum ada, aplikasi otomatis berjalan dalam **mode demo**: semua data disimpan di browser, sudah berisi 6 toko contoh di sekitar BINUS Anggrek dan riwayat penjualan 10 hari. Di halaman **Masuk** ada tombol akun demo:

| Peran | Email | Kata sandi |
|---|---|---|
| Pembeli | `pembeli@demo.id` | `demo123` |
| Mitra (Roti Senja Kemanggisan) | `mitra@demo.id` | `demo123` |

Tips presentasi: buka dua tab, satu masuk sebagai mitra dan satu sebagai pembeli. Saat mitra menayangkan stok, tab pembeli langsung mendapat notifikasi; saat pembeli memesan, tab mitra mendapat “Pesanan baru”. Reset data ada di halaman **Akun**.

## Menghubungkan ke Supabase

1. Buat project gratis di [supabase.com](https://supabase.com).
2. Buka **SQL Editor → New query**, tempel isi `supabase/schema.sql`, lalu **Run**. File ini membuat tabel, Row Level Security, fungsi pemesanan atomik, bucket foto, dan realtime.
3. (Opsional) Jalankan `supabase/seed.sql` untuk 6 toko contoh dengan stok aktif.
4. **Authentication → Sign In / Providers → Email**: untuk uji coba, matikan *Confirm email* supaya akun baru langsung bisa masuk.
5. **Project Settings → API**: salin *Project URL* dan *anon public key*.
6. Salin `.env.example` menjadi `.env`, isi:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
7. Jalankan ulang `npm run dev`. Halaman Akun akan menampilkan “Terhubung ke database Supabase”.

**Jadwal otomatis (opsional):** aktifkan extension `pg_cron` di **Database → Extensions**, lalu jalankan perintah `cron.schedule` yang ada di bagian akhir `schema.sql`.

## Struktur database

| Tabel | Isi |
|---|---|
| `profiles` | Akun pembeli / mitra (dibuat otomatis saat daftar) |
| `stores` | Toko mitra, titik lokasi, jam tutup, rating |
| `listings` | Stok surplus harian: harga, porsi tersisa, jam ambil, cek kelayakan |
| `orders` | Pesanan + kode `BGS-XXXX`; hanya dibuat lewat fungsi `place_order` |
| `reviews` | Ulasan setelah pesanan diambil; rating toko diperbarui otomatis |
| `favorites` | Toko favorit pembeli |
| `schedules` | Jadwal stok rutin mitra |

Fungsi RPC: `place_order` (kunci stok, kurangi porsi, buat kode), `cancel_order`, `complete_order` (verifikasi kasir), `publish_schedules`. Pembeli hanya bisa melihat pesanannya sendiri, mitra hanya pesanan tokonya, dan hanya akun mitra yang bisa membuat toko.

## Deploy

```bash
npm run build
```

Folder `dist/` bisa diunggah ke Netlify, Vercel, atau GitHub Pages (routing memakai hash, jadi tidak perlu pengaturan rewrite). Tambahkan variabel `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di pengaturan environment hosting.

## Belum termasuk (tahap berikutnya)

- Payment gateway sungguhan (Midtrans / Xendit) dan pencairan dana otomatis ke mitra
- Integrasi armada kurir Gojek / GoFood
- Push notification saat aplikasi ditutup (sekarang notifikasi muncul selama tab terbuka)
- Aplikasi Android / iOS (web app ini sudah mobile-first dan bisa dibungkus dengan Capacitor)
