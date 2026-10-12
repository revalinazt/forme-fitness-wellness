# FORME Fitness & Wellness

Sistem informasi akuntansi membership dan pengakuan pendapatan pada FORME Fitness & Wellness. Aplikasi memakai HTML, CSS, JavaScript, Node.js built-in HTTP server, dan Supabase PostgreSQL melalui REST API.

🌐 **Demo Website:** [FORME Fitness & Wellness](https://revalinazt.github.io/forme-fitness-wellness/)

## Struktur

- `public/` - dashboard dan aplikasi frontend statis
- `sql/schema.sql` - empat tabel operasional: customers, membership_plans, memberships, payments, beserta constraint, index, dan RLS
- `app.js` - static server dan health endpoint

## Menjalankan

```bash
node app.js
```

Buka `http://localhost:3000`, lalu masukkan Project URL dan Publishable Key Supabase melalui menu Settings. Jalankan isi `sql/schema.sql` di SQL Editor Supabase terlebih dahulu. Schema mempertahankan ERD empat tabel; jika pernah menjalankan versi Class Schedule yang tersimpan di Supabase, jalankan ulang schema untuk membersihkan tabel/kolom sementara tersebut. Customer, membership, dan payment contoh tidak dibuat sebagai data sistem.

Frontend juga dapat dipublikasikan sebagai situs statis di GitHub Pages. Fitur data memerlukan Project URL, publishable key, serta policy RLS Supabase yang sesuai; server Node hanya diperlukan untuk menjalankan situs secara lokal. Tanpa koneksi, aplikasi menampilkan keadaan kosong dan tidak mengklaim perubahan CRUD tersimpan.

## Pengakuan Pendapatan

Payment berstatus `paid` membentuk jurnal Dr Kas dan Cr Pendapatan Diterima di Muka. Penerimaan dialokasikan per bulan kalender selama sisa periode membership, tanpa prorata harian; pengakuan dimulai pada tanggal layanan atau payment dalam bulan pertama. Jurnal pengakuan bulanan mendebit Pendapatan Diterima di Muka dan mengkredit Pendapatan Membership. Journal, General Ledger, dashboard, dan laporan menghitung angka dari baris payment Supabase melalui aturan yang sama; jurnal tidak diketik manual.

Customer tetap menjadi master untuk non-member maupun member; tipe member diturunkan dari membership aktif/historis, bukan tabel customer terpisah. Class Schedule adalah simulasi frontend: sesi dan perubahan pendaftaran hanya hidup di state browser, tanpa tabel atau query Supabase. Nama peserta memakai customer/membership yang benar-benar termuat. Akses class diturunkan dari nama plan dan access label existing; Gym dan Women Only adalah facility access, sedangkan Pilates, Yoga, Zumba, dan Functional Training adalah scheduled classes. All Access mencakup semua layanan.

Jadwal/pendaftaran class tidak membentuk payment atau jurnal dan tidak mengubah pengakuan pendapatan membership.

## ERD

`customers` menjadi entitas pelanggan. `membership_plans` menyimpan katalog paket. `memberships` menghubungkan pelanggan ke paket dan mencatat periode/nominal. `payments` mencatat pembayaran membership dan menjadi dasar informasi pendapatan.

> **Penting untuk deployment:** publishable key memang dapat berada di browser, tetapi policy schema memberi role `anon` akses baca/tulis ke customers, memberships, dan payments. RLS yang aktif saja tidak membuat policy tersebut aman untuk data nyata. Sebelum mempublikasikan database produksi, batasi akses ke role `authenticated`, tambahkan alur login yang sesuai, dan uji policy. Jangan menaruh service role key di frontend.
