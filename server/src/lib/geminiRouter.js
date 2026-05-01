'use strict';

/**
 * Gemini AI proxy — endpoint POST /chat untuk HealthcareBot.
 *
 * Mengapa di server, bukan di client?
 *   1. API key tidak boleh ter-bundle ke aplikasi mobile (siapa saja yang
 *      memegang APK/IPA bisa mengekstraknya).
 *   2. Server menjalankan auth (JWT Supabase), rate-limit, dan memegang
 *      kontrol penuh atas system prompt — mencegah prompt injection.
 *   3. Provider/model bisa diganti tanpa rebuild client.
 *
 * Body request yang diharapkan:
 *   {
 *     "history":  [{ "role": "user"|"model", "parts": [{ "text": "..." }] }],
 *     "message":  "string — pesan terbaru dari user"
 *   }
 *   Catatan: parameter `system` SENGAJA tidak diterima dari client.
 *   Server membangun system prompt sendiri dengan konteks klinik real-time
 *   dari Supabase, bukan dari data yang dikirim client.
 *
 * Response:
 *   { "reply": "string" }   atau   { "error": "..." }
 *
 * Header request:
 *   Authorization: Bearer <supabase-access-token>   (WAJIB)
 */
const express = require('express');
const { supabaseAdmin } = require('./supabase');
const { requireSupabaseAuth } = require('./httpAuth');
const { createRateLimiter } = require('./rateLimit');
const { buildHealthcareFallbackReply } = require('./healthFallback');
const { buildClinicContext, formatDoctorRecommendations } = require('./clinicContext');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || 'v1beta';
const GEMINI_URL = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent`;
const FETCH_TIMEOUT_MS = Number(process.env.GEMINI_FETCH_TIMEOUT_MS || 15_000);

// Maks 30 request per user per menit. Default cukup longgar untuk
// percakapan natural; cukup ketat untuk mencegah abuse.
const chatLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

const router = express.Router();

/**
 * Ambil konteks klinik aktual dari database.
 * Data diambil server-side sehingga tidak bisa dipalsukan client.
 */
async function getClinicContext() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [doctorsResult, schedulesResult, appointmentsResult] = await Promise.all([
      supabaseAdmin
        .from('doctors')
        .select('id, name, specialty, is_active')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('doctor_schedules')
        .select('doctor_id, day_of_week, is_active, start_time, end_time'),
      supabaseAdmin
        .from('appointments')
        .select('doctor_id, status, appointment_date')
        .gte('appointment_date', today)
        .neq('status', 'Cancelled'),
    ]);

    if (doctorsResult.error) throw doctorsResult.error;
    if (schedulesResult.error) throw schedulesResult.error;
    if (appointmentsResult.error) throw appointmentsResult.error;

    return buildClinicContext({
      doctors: doctorsResult.data || [],
      schedules: schedulesResult.data || [],
      appointments: appointmentsResult.data || [],
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[clinic-context] failed to load database context', err.message || err);
    return buildClinicContext();
  }
}

function sendFallback(res, message, clinicContext, reason, status) {
  const reply = buildHealthcareFallbackReply(message, {
    doctorListLine: clinicContext.doctorListLine,
    clinicContext,
  });
  return res.json({
    reply,
    source: 'fallback',
    reason,
    ...(status ? { status } : {}),
  });
}

/**
 * Bangun system prompt untuk Gemini.
 */
function buildSystemPrompt(clinicContext, userText) {
  const recommendationHint = formatDoctorRecommendations(userText, clinicContext);
  return `Anda adalah asisten medis virtual bernama HealthcareBot untuk klinik CareConnect.

KONTEKS DATABASE KLINIK (real-time dari Supabase):
Ringkasan spesialis aktif: ${clinicContext.specialtySummaryLine}

DAFTAR DOKTER AKTIF:
${clinicContext.doctorListLine}

PANDUAN REKOMENDASI SPESIALIS:
${clinicContext.recommendationGuideLine}

REKOMENDASI TERDETEKSI DARI PESAN TERBARU:
${recommendationHint || 'Belum ada spesialis yang jelas dari pesan terbaru.'}

TUGAS ANDA:
- Jawab dalam bahasa Indonesia yang ramah, profesional, dan mudah dipahami.
- Fokus pada topik kesehatan, gejala, penyakit, pencegahan, gaya hidup sehat, dan arahan konsultasi awal.
- Bantu pasien menilai gejala awal dan memberikan edukasi medis dasar, tetapi jangan membuat diagnosis pasti.
- Jika ditanya siapa saja dokter yang ada, tampilkan daftar dokter aktif di atas beserta spesialisasi dan jadwal ringkasnya.
- Jika pasien meminta rekomendasi dokter, gunakan konteks database dan panduan spesialis di atas. Prioritaskan dokter aktif dengan antrean mendatang paling sedikit.
- Jika keluhan masih umum atau ambigu, rekomendasikan Dokter Umum untuk pemeriksaan awal dan tanyakan detail singkat.
- Selalu ingatkan bahwa saran Anda tidak menggantikan diagnosis dokter yang sesungguhnya.
- Jangan memberi resep, dosis obat spesifik, atau instruksi tindakan medis berisiko. Sarankan konsultasi dokter untuk keputusan terapi.
- Untuk tanda bahaya seperti nyeri dada, sesak napas, pingsan, kejang, kelemahan satu sisi tubuh, perdarahan hebat, muntah darah, atau penurunan kesadaran, arahkan pasien segera ke IGD/layanan gawat darurat.
- Jika informasi kurang, ajukan pertanyaan lanjutan singkat: usia, durasi keluhan, gejala penyerta, riwayat penyakit/alergi, obat yang sudah digunakan, dan tanda bahaya.
- Jika tidak relevan dengan kesehatan, arahkan kembali ke topik kesehatan secara sopan.`;
}

router.post('/chat', requireSupabaseAuth, chatLimiter, async (req, res) => {
  try {
    const { history, message } = req.body || {};
    const userText = typeof message === 'string' ? message.trim() : '';
    if (!userText) {
      return res.status(400).json({ error: 'EMPTY_MESSAGE' });
    }
    if (userText.length > 4000) {
      return res.status(413).json({ error: 'MESSAGE_TOO_LONG' });
    }

    const clinicContext = await getClinicContext();
    if (!GEMINI_API_KEY) {
      return sendFallback(res, userText, clinicContext, 'GEMINI_NOT_CONFIGURED');
    }

    // Susun contents Gemini-style; abaikan turn invalid agar payload bersih.
    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || typeof turn !== 'object') continue;
        const role = turn.role === 'model' ? 'model' : 'user';
        const parts = Array.isArray(turn.parts)
          ? turn.parts
              .filter((p) => p && typeof p.text === 'string' && p.text.length > 0)
              .map((p) => ({ text: String(p.text).slice(0, 4000) }))
          : [];
        if (parts.length === 0) continue;
        contents.push({ role, parts });
      }
    }
    contents.push({ role: 'user', parts: [{ text: userText }] });

    const systemPrompt = buildSystemPrompt(clinicContext, userText);
    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    };

    // Timeout fetch supaya request lambat dari Gemini tidak menahan koneksi.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // API key di header (bukan URL) agar tidak terjepret di log proxy.
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      if (fetchErr?.name === 'AbortError') {
        return sendFallback(res, userText, clinicContext, 'GEMINI_TIMEOUT');
      }
      throw fetchErr;
    }
    clearTimeout(timer);

    if (!upstream.ok) {
      const errBody = await upstream.text();
      // eslint-disable-next-line no-console
      console.error('[gemini] upstream error', upstream.status, errBody.slice(0, 500));
      return sendFallback(res, userText, clinicContext, 'GEMINI_UPSTREAM_ERROR', upstream.status);
    }

    const data = await upstream.json();
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || '')
      .filter(Boolean)
      .join('\n') || '';

    if (!reply) {
      return sendFallback(res, userText, clinicContext, 'GEMINI_EMPTY_RESPONSE');
    }
    return res.json({ reply });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gemini] handler error', err);
    return res.json({
      reply: buildHealthcareFallbackReply(req.body?.message || ''),
      source: 'fallback',
      reason: err.message || 'INTERNAL_ERROR',
    });
  }
});

module.exports = router;
