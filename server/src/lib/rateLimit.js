'use strict';

/**
 * Rate limiter sederhana berbasis sliding window in-memory.
 * Ditujukan untuk satu instance server (klinik kecil); kalau scaled
 * ke beberapa pod, ganti dengan Redis-backed limiter.
 *
 * Implementasi:
 *  - Map<key, number[]> = timestamp request dalam window terakhir.
 *  - Setiap request: bersihkan timestamp lebih lama dari `windowMs`,
 *    cek jumlah, push timestamp baru.
 *  - Header `Retry-After` dikembalikan saat limit terlampaui.
 *
 * Pemakaian:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
 *   app.use('/chat', limiter);
 */
function createRateLimiter({
  windowMs = 60_000,
  max = 30,
  keyFn = (req) => req.user?.id || req.ip,
} = {}) {
  const buckets = new Map();

  // Garbage-collect bucket yang sudah lama tidak dipakai supaya Map tidak
  // membengkak tanpa batas. Cleanup setiap 5 menit cukup untuk
  // workload klinik.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of buckets.entries()) {
      const keep = arr.filter((t) => now - t < windowMs);
      if (keep.length === 0) buckets.delete(k);
      else buckets.set(k, keep);
    }
  }, 5 * 60_000);
  // Jangan menahan event loop dari proses keluar gracefully.
  if (typeof sweep.unref === 'function') sweep.unref();

  return function rateLimit(req, res, next) {
    const key = String(keyFn(req) || 'anonymous');
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);

    if (arr.length >= max) {
      const oldest = arr[0];
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: `Terlalu banyak permintaan. Coba lagi dalam ${retryAfterSec} detik.`,
      });
    }

    arr.push(now);
    buckets.set(key, arr);
    return next();
  };
}

module.exports = { createRateLimiter };
