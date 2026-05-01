'use strict';

/**
 * Express middleware untuk memverifikasi access-token Supabase.
 *
 * Token diharapkan datang sebagai header `Authorization: Bearer <jwt>`.
 * Jika valid, payload user disimpan di `req.user = { id, email, role }`.
 *
 * Berbeda dari `socket auth.js` yang dirancang untuk handshake Socket.IO,
 * middleware ini cocok untuk REST endpoint (mis. /chat HealthcareBot).
 *
 * Mengapa wajib?
 *  - Endpoint /chat berbicara dengan Gemini API yang berbiaya per request.
 *    Tanpa auth, siapa pun yang menebak URL bisa menghabiskan kuota.
 *  - Penyerang bisa mengirim system prompt sewenang-wenang untuk prompt
 *    injection. Auth membatasi ke pasien terdaftar saja.
 */
const { supabaseAuth } = require('./supabase');

async function requireSupabaseAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing bearer token.' });
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token.' });
    }

    const u = data.user;
    req.user = {
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || 'user',
    };
    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requireSupabaseAuth]', err);
    return res.status(500).json({ error: 'AUTH_FAILED' });
  }
}

module.exports = { requireSupabaseAuth };
