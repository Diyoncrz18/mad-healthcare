'use strict';

const { supabaseAuth, supabaseAdmin } = require('./supabase');

/**
 * Socket.IO middleware — verifikasi access token Supabase.
 * Token dikirim di handshake.auth.token oleh client.
 *
 * Setelah valid, payload user disimpan di socket.data.user dan
 * profil dokter (jika ada) di socket.data.doctor.
 */
async function attachAuth(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('UNAUTHORIZED: token kosong'));
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return next(new Error('UNAUTHORIZED: token tidak valid'));
    }

    const user = data.user;
    const role = user.user_metadata?.role || 'user';

    // Untuk role doctor, ambil baris doctors-nya supaya kita bisa
    // memvalidasi keanggotaan chat tanpa query berulang.
    let doctor = null;
    if (role === 'doctor') {
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('doctors')
        .select('id, user_id, name, specialty')
        .eq('user_id', user.id)
        .maybeSingle();
      if (docErr) return next(new Error('AUTH_DOCTOR_LOOKUP_FAILED'));
      doctor = doc || null;
    }

    socket.data.user = { id: user.id, email: user.email, role };
    socket.data.doctor = doctor;
    return next();
  } catch (err) {
    return next(new Error(err.message || 'AUTH_FAILED'));
  }
}

module.exports = { attachAuth };
