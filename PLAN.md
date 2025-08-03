# Plan
## Fitur Utama

1. **Autentikasi Pengguna**
  - User dapat melakukan registrasi dan login.
  - Otentikasi menggunakan JWT (fast-jwt) dan enkripsi password dengan bcrypt.

2. **Manajemen Kegiatan**
  - Setelah login, user dapat membuat kegiatan/event.
  - Saat membuat kegiatan, user menentukan field identifikasi peserta (misal: nama, jabatan, instansi, dsb) yang dapat disesuaikan sesuai kebutuhan.

3. **Manajemen Peserta**
  - Import data peserta melalui file Excel (.xlsx) atau input manual satu per satu.
  - Field peserta mengikuti konfigurasi yang ditentukan saat pembuatan kegiatan.

4. **Template Sertifikat Dinamis**
  - Editor visual berbasis React.js dengan Material UI dan Fabric.js (atau Konva.js sebagai alternatif).
  - User dapat menambahkan elemen teks/gambar ke template, mengatur posisi, ukuran, dan styling.
  - Field dinamis (misal: nama peserta) dapat di-inject ke template sebagai placeholder yang akan digantikan data peserta saat generate sertifikat.

5. **Generate & Download Sertifikat**
  - Sertifikat dapat di-generate secara otomatis untuk seluruh peserta atau per peserta dengan data dinamis.
  - Sertifikat dapat diunduh dalam format PDF.

## Tampilan Aplikasi

Aplikasi e-Sertifikat dirancang dengan **tampilan elegan, modern, dan responsif** menggunakan Material UI. Setiap halaman dan komponen akan menyesuaikan tampilan pada berbagai perangkat (desktop, tablet, mobile) untuk memastikan pengalaman pengguna yang optimal. Desain mengutamakan kemudahan navigasi, konsistensi warna, tipografi yang jelas, serta penggunaan elemen visual yang bersih dan profesional.

## Struktur Directory

Untuk optimasi pengembangan dan deployment, **direkomendasikan memisahkan directory frontend dan backend**. Struktur yang umum digunakan:

```
/project-root
  /backend    # Fastify, Sequelize, dsb.
    /controllers   # Handler untuk request/response
    /models        # Definisi model Sequelize
    /services      # Logika bisnis dan interaksi data
  /frontend   # React.js, Vite, dsb.
```

**Kelebihan pemisahan:**
- Pengembangan lebih terstruktur dan modular.
- Backend lebih maintainable dengan pemisahan controller, model, dan service.
- Deployment dapat dilakukan secara independen (misal: frontend di Vercel/Netlify, backend di VPS/Cloud).
- Memudahkan scaling dan maintenance.

**Alternatif:**
Jika ingin lebih sederhana (misal untuk prototipe), frontend bisa diletakkan dalam subfolder backend dan disajikan sebagai static files oleh backend. Namun, untuk project production, pemisahan lebih disarankan.

## Teknologi

- **Frontend:**
  - React.js + Vite
  - Material UI (desain modern & responsif)
  - Konva.js

- **Backend:**
  - Fastify
  - @fastify/autoload
  - @fastify/cors
  - dotenv
  - Sequelize (ORM)
  - PostgreSQL
  - fast-jwt (JWT authentication)
  - bcrypt (hashing password)
  - Multer (upload file Excel)
  - xlsx (parsing file Excel)
  - PDF generation: Puppeteer

## Alur Penggunaan

1. User register/login.
2. Membuat kegiatan dan menentukan field peserta.
3. Import atau input peserta.
4. Membuat/mengedit template sertifikat dengan field dinamis.
5. Generate dan download sertifikat PDF untuk peserta.