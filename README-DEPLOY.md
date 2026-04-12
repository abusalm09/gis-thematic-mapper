# Panduan Deploy ke Railway

## Prasyarat
- Akun Railway (daftar di https://railway.app dengan GitHub)
- Repository GitHub sudah terhubung: `abusalm09/gis-thematic-mapper`

---

## Langkah 1: Buat Project di Railway

1. Login ke https://railway.app
2. Klik **"New Project"**
3. Pilih **"Deploy from GitHub repo"**
4. Pilih repository **`gis-thematic-mapper`**
5. Klik **"Deploy Now"**

---

## Langkah 2: Tambahkan MySQL Database

1. Di dalam project Railway, klik **"+ New"**
2. Pilih **"Database"** → **"Add MySQL"**
3. Railway otomatis membuat database dan mengisi `DATABASE_URL`

---

## Langkah 3: Set Environment Variables

Di Railway project → tab **"Variables"**, tambahkan variabel berikut:

| Variable | Nilai |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | String acak 32+ karakter (contoh: `abc123xyz...`) |
| `VITE_APP_TITLE` | `GIS Thematic Mapper` |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` |
| `BUILT_IN_FORGE_API_URL` | `https://api.manus.im` |

> Catatan: `DATABASE_URL` otomatis terisi dari MySQL service Railway.

---

## Langkah 4: Generate Domain

1. Di Railway project → tab **"Settings"**
2. Klik **"Generate Domain"**
3. Aplikasi akan tersedia di URL seperti: `https://gis-thematic-mapper.up.railway.app`

---

## Langkah 5: Jalankan Migrasi Database

Setelah deploy pertama berhasil:
1. Di Railway → tab **"Deploy"** → klik **"Run Command"**
2. Jalankan: `pnpm drizzle-kit migrate`

---

## Troubleshooting

- **Build gagal**: Pastikan `nixpacks.toml` sudah ada di root project
- **Database error**: Cek `DATABASE_URL` sudah terisi otomatis dari MySQL service
- **Port error**: Pastikan variable `PORT=3000` sudah diset
