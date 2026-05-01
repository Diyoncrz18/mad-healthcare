'use strict';

const express = require('express');
const { requireSupabaseAuth } = require('./httpAuth');
const { supabaseAdmin } = require('./supabase');
const { room } = require('./chatHandlers');

const router = express.Router();

const CALL_TITLE = 'Panggilan Dokter';

const buildCallMessage = (appointment) =>
  `Pasien ${appointment.patient_name || 'pasien'}, ${appointment.doctor_name || 'dokter'} memanggil Anda. Silakan masuk ke ruangan konsultasi.`;

router.post('/appointments/:appointmentId/call-patient', requireSupabaseAuth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'ROLE_NOT_ALLOWED' });
    }

    const appointmentId = String(req.params.appointmentId || '').trim();
    if (!appointmentId) {
      return res.status(400).json({ error: 'APPOINTMENT_ID_REQUIRED' });
    }

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('appointments')
      .select('id, user_id, patient_name, doctor_id, doctor_name, status, appointment_date, appointment_time, date, doctor:doctors!inner(user_id)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointmentError) throw appointmentError;
    if (!appointment) {
      return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    }

    if (appointment.doctor?.user_id !== req.user.id) {
      return res.status(403).json({ error: 'DOCTOR_MISMATCH' });
    }

    if (appointment.status !== 'Confirmed') {
      return res.status(409).json({
        error: 'APPOINTMENT_NOT_CONFIRMED',
        message: 'Pasien hanya bisa dipanggil setelah reservasi dikonfirmasi.',
      });
    }

    const message = buildCallMessage(appointment);
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert([
        {
          recipient_id: appointment.user_id,
          type: 'appointment',
          title: CALL_TITLE,
          message,
          related_appointment_id: appointment.id,
        },
      ])
      .select('id, created_at')
      .single();

    if (notificationError) throw notificationError;

    const payload = {
      appointmentId: appointment.id,
      notificationId: notification.id,
      patientId: appointment.user_id,
      patientName: appointment.patient_name || 'Pasien',
      doctorName: appointment.doctor_name || 'Dokter',
      title: CALL_TITLE,
      message,
      createdAt: notification.created_at,
    };

    const io = req.app.get('io');
    if (io) {
      io.to(room.user(appointment.user_id)).emit('patient:called', payload);
    }

    return res.json({ ok: true, notification, call: payload });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[appointment-call] failed', err);
    return res.status(500).json({
      error: 'PATIENT_CALL_FAILED',
      message: err.message || 'Gagal memanggil pasien.',
    });
  }
});

module.exports = router;
