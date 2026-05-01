'use strict';

const express = require('express');
const { supabaseAdmin } = require('./supabase');
const { requireSupabaseAuth } = require('./httpAuth');

const router = express.Router();

async function getDoctor(doctorId) {
  const { data, error } = await supabaseAdmin
    .from('doctors')
    .select('id, user_id, name, specialty, is_active')
    .eq('id', doctorId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensurePatientProfile(user) {
  const { data, error } = await supabaseAdmin
    .from('patient_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabaseAdmin
    .from('patient_profiles')
    .insert([
      {
        user_id: user.id,
        email: user.email || `${user.id}@unknown.local`,
        display_name: user.email ? user.email.split('@')[0] : 'Pasien',
      },
    ]);

  if (insertError) throw insertError;
}

async function getOrCreateConversation(patientId, doctorId) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('chat_conversations')
    .insert([{ patient_id: patientId, doctor_id: doctorId }])
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

router.post('/conversations', requireSupabaseAuth, async (req, res) => {
  try {
    const patientId = String(req.body?.patientId || '').trim();
    const doctorId = String(req.body?.doctorId || '').trim();

    if (!patientId || !doctorId) {
      return res.status(400).json({ error: 'MISSING_PARTICIPANTS' });
    }

    const doctor = await getDoctor(doctorId);
    if (!doctor?.user_id) {
      return res.status(404).json({
        error: 'DOCTOR_CHAT_UNAVAILABLE',
        message: 'Akun chat dokter ini belum terhubung.',
      });
    }

    if (doctor.is_active === false) {
      return res.status(409).json({
        error: 'DOCTOR_INACTIVE',
        message: 'Dokter sedang tidak aktif untuk konsultasi chat.',
      });
    }

    if (req.user.role === 'user') {
      if (req.user.id !== patientId) {
        return res.status(403).json({ error: 'PATIENT_MISMATCH' });
      }
      await ensurePatientProfile(req.user);
    } else if (req.user.role === 'doctor') {
      if (doctor.user_id !== req.user.id) {
        return res.status(403).json({ error: 'DOCTOR_MISMATCH' });
      }
    } else {
      return res.status(403).json({ error: 'ROLE_NOT_ALLOWED' });
    }

    const conversation = await getOrCreateConversation(patientId, doctorId);
    return res.json({ conversation });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[conversation] create failed', err);
    return res.status(500).json({
      error: 'CONVERSATION_CREATE_FAILED',
      message: err.message || 'Gagal membuat percakapan.',
    });
  }
});

module.exports = router;
