'use strict';

const { createClient } = require('@supabase/supabase-js');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
} = process.env;

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL belum di-set di .env');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set di .env');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY belum di-set di .env');
}

/**
 * supabaseAdmin — service-role client. Pakai HANYA di server.
 * Bypass RLS, jadi semua validasi keanggotaan chat dilakukan manual
 * sebelum insert/select data sensitif.
 */
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * supabaseAuth — anon client untuk validasi JWT user.
 * Digunakan oleh middleware auth pada socket handshake.
 */
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabaseAdmin, supabaseAuth };
