# e-Sertifikat - Digital Certificate Management System

Sistem manajemen sertifikat digital yang memungkinkan pengguna untuk membuat kegiatan/event, mengelola peserta, membuat template sertifikat dinamis, dan menghasilkan sertifikat PDF secara otomatis.

## Fitur Utama

- **Autentikasi Pengguna**: Registrasi dan login dengan JWT authentication
- **Manajemen Kegiatan**: Membuat dan mengelola event dengan konfigurasi field peserta
- **Manajemen Peserta**: Import data peserta melalui Excel atau input manual
- **Template Sertifikat Dinamis**: Editor visual dengan Konva.js untuk membuat template
- **Generate Sertifikat**: Otomatis generate sertifikat PDF untuk peserta (dengan pemrosesan paralel untuk kecepatan)

## Teknologi

### Backend
- Fastify (Web Framework)
- Sequelize (ORM)
- PostgreSQL (Database)
- JWT (Authentication)
- bcrypt (Password Hashing)
- Puppeteer (PDF Generation)
- xlsx (Excel Processing)

### Frontend
- React.js + Vite
- Material UI (Component Library)
- Konva.js (Canvas Editor)
- React Router (Routing)
- Axios (HTTP Client)

## Prerequisites

Pastikan Anda telah menginstall:
- Node.js (v18 atau lebih baru)
- PostgreSQL (v12 atau lebih baru)
- npm atau yarn

## Instalasi

### 1. Clone Repository
```bash
git clone <repository-url>
cd e_sertifikat
```

### 2. Setup Database
Buat database PostgreSQL:
```sql
CREATE DATABASE e_sertifikat;
```

### 3. Setup Backend

```bash
cd backend
npm install
```

Copy file .env dan sesuaikan konfigurasi database:
```bash
cp .env.example .env
```

Edit file `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=e_sertifikat
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development

# Optional: Configure certificate generation concurrency (default: 5)
CERTIFICATE_CONCURRENCY_LIMIT=5
```

### 4. Setup Frontend

```bash
cd ../frontend
npm install
```

## Menjalankan Aplikasi

### 1. Jalankan Backend
```bash
cd backend
npm run dev
```
Server akan berjalan di http://localhost:3000

### 2. Jalankan Frontend
Buka terminal baru:
```bash
cd frontend
npm run dev
```
Aplikasi akan berjalan di http://localhost:5173

## API Endpoints

### Authentication
- `POST /api/auth/register` - Registrasi user baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - Logout user

### Events
- `GET /api/events` - Get semua events user
- `POST /api/events` - Buat event baru
- `GET /api/events/:id` - Get detail event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Hapus event

### Participants
- `GET /api/events/:eventId/participants` - Get peserta event
- `POST /api/events/:eventId/participants` - Tambah peserta
- `POST /api/events/:eventId/participants/import` - Import peserta dari Excel
- `PUT /api/participants/:id` - Update peserta
- `DELETE /api/participants/:id` - Hapus peserta

### Certificates
- `GET /api/certificates/events/:eventId/templates` - Get template sertifikat
- `POST /api/certificates/templates` - Buat template baru
- `PUT /api/certificates/templates/:id` - Update template
- `DELETE /api/certificates/templates/:id` - Hapus template
- `POST /api/certificates/templates/:templateId/participants/:participantId/generate` - Generate sertifikat
- `POST /api/certificates/templates/:templateId/generate-all` - Generate semua sertifikat

## Struktur Project

```
e_sertifikat/
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── AuthController.js
│   │   ├── EventController.js
│   │   ├── ParticipantController.js
│   │   └── CertificateController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Event.js
│   │   ├── Participant.js
│   │   ├── CertificateTemplate.js
│   │   └── index.js
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── EventService.js
│   │   ├── ParticipantService.js
│   │   └── CertificateService.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   ├── participants.js
│   │   └── certificates.js
│   ├── middleware/
│   │   └── auth.js
│   ├── uploads/
│   ├── .env
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Development

### Menjalankan dalam Mode Development
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Build untuk Production
```bash
# Build frontend
cd frontend
npm run build

# Backend sudah siap untuk production
cd backend
npm start
```

## Troubleshooting

### Database Connection Error
- Pastikan PostgreSQL sudah berjalan
- Periksa konfigurasi database di file `.env`
- Pastikan database `e_sertifikat` sudah dibuat

### Port Already in Use
- Ubah port di file `.env` (backend) atau `vite.config.js` (frontend)
- Atau stop proses yang menggunakan port tersebut

### CORS Error
- Pastikan URL frontend sudah ditambahkan di konfigurasi CORS backend
- Check file `server.js` bagian CORS configuration

## Kontribusi

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
