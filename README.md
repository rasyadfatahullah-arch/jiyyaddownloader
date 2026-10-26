# JIYYAD TOOLS - Video Downloader

Website downloader video bertema neon (TikTok, Instagram, X, YouTube, Facebook, dll).

## Deploy (GitHub + Vercel)

1. Upload semua file ke repo GitHub.
2. Import repo di Vercel.
3. Buka **Settings > Environment Variables**, tambahkan:
   - Name: `KAYZ_API_KEY`
   - Value: API key kamu
4. Deploy (atau Redeploy kalau env baru ditambahkan setelah deploy).

API key hanya dibaca di server (`api/download.js`), tidak pernah dikirim ke browser.

## Tes lokal

```
npm i -g vercel
cp .env.example .env.local   # isi KAYZ_API_KEY
vercel dev
```

`.env` dan `.env.local` sudah masuk `.gitignore`, jadi tidak ikut ter-upload.
