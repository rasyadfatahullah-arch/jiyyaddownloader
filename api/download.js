// JIYYAD TOOLS - Video Downloader (serverless proxy)
// API key TIDAK ada di kode ini. Simpan di Environment Variable: KAYZ_API_KEY

const API_BASE = "https://apikayz.clutch.web.id/download/aio";

const MEDIA_EXT = /\.(mp4|m4v|webm|mov|mp3|m4a|aac|ogg|wav|jpg|jpeg|png|webp|gif)(\?|$)/i;
const SKIP_KEYS = /^(thumbnail|thumb|cover|poster|image|icon|avatar|preview|origin_cover|dynamic_cover)$/i;

function collect(node, out, path = "") {
  if (!node) return;
  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node)) {
      const key = path.split(".").pop() || "";
      if (SKIP_KEYS.test(key)) return;
      out.push({ url: node, path });
    }
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, out, `${path}.${i}`));
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) collect(v, out, `${path}.${k}`);
  }
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && typeof obj[k] === "string" && obj[k]) return obj[k];
  }
  return "";
}

function guessLabel(url, path) {
  const p = path.toLowerCase();
  const isAudio = /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i.test(url) || /audio|music|mp3/.test(p);
  const isImage = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) || /image|photo|img/.test(p);
  const q = /hd|1080|high/.test(p) ? "HD" : /sd|480|360|low/.test(p) ? "SD" : "";
  const wm = /watermark|wm/.test(p) && !/nowm|no_wm|without/.test(p) ? " (Watermark)" : "";
  if (isAudio) return "Audio MP3";
  if (isImage) return "Gambar";
  return `Video${q ? " " + q : ""}${wm}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method tidak diizinkan." });
  }

  const input = (req.method === "POST" ? req.body?.url : req.query?.url) || "";
  const target = String(input).trim();

  let parsed;
  try {
    parsed = new URL(target);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ ok: false, error: "Link tidak valid. Tempel link video yang benar." });
  }

  const apiKey = process.env.KAYZ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: "Server belum dikonfigurasi (KAYZ_API_KEY belum diisi)." });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);

    const upstream = await fetch(
      `${API_BASE}?apikey=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(parsed.href)}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(timer);

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!upstream.ok || !data) {
      return res.status(502).json({ ok: false, error: "Server downloader sedang bermasalah. Coba lagi nanti." });
    }

    // Cari bagian data utama (berbagai kemungkinan struktur)
    const root = data.result || data.data || data.results || data;
    const meta = Array.isArray(root) ? root[0] || {} : root;

    const found = [];
    collect(root, found);

    const seen = new Set();
    const links = [];
    for (const f of found) {
      if (seen.has(f.url)) continue;
      const looksMedia = MEDIA_EXT.test(f.url) || /download|video|audio|media|url|link|hd|sd|nowm|mp4|mp3/i.test(f.path);
      if (!looksMedia) continue;
      seen.add(f.url);
      links.push({ label: guessLabel(f.url, f.path), url: f.url });
    }

    // Beri nomor jika label sama
    const count = {};
    links.forEach((l) => {
      count[l.label] = (count[l.label] || 0) + 1;
      if (count[l.label] > 1) l.label += ` ${count[l.label]}`;
    });

    if (!links.length) {
      return res.status(404).json({ ok: false, error: "Video tidak ditemukan. Pastikan link publik dan benar." });
    }

    return res.status(200).json({
      ok: true,
      title: pick(meta, ["title", "caption", "desc", "description", "text"]) || "Video siap diunduh",
      thumbnail: pick(meta, ["thumbnail", "thumb", "cover", "image", "poster"]),
      author: pick(meta, ["author", "username", "nickname", "uploader"]),
      links: links.slice(0, 8),
    });
  } catch (err) {
    const timeout = err && err.name === "AbortError";
    return res.status(504).json({
      ok: false,
      error: timeout ? "Waktu habis. Coba lagi." : "Gagal menghubungi server downloader.",
    });
  }
}
