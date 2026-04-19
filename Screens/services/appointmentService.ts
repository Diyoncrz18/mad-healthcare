/**
 * Appointment Service — Abstraction layer untuk operasi CRUD tabel `appointments`.
 */
import { supabase } from '../../supabase';
import { Appointment, AppointmentStatus, UserRole } from '../types';

/**
 * Mengambil daftar appointment berdasarkan role.
 * - User: hanya appointment milik sendiri.
 * - Admin: semua appointment.
 */
export const fetchAppointments = async (
  userId: string,
  role: UserRole
): Promise<Appointment[]> => {
  let query = supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (role === 'user') {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Appointment[]) || [];
};

/**
 * Mengecek slot waktu yang sudah dipesan untuk dokter tertentu di tanggal tertentu.
 */
export const fetchBookedSlots = async (
  doctorId: string,
  dateStr: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_time, date')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', dateStr)
    .neq('status', 'Cancelled');

  if (error) throw error;
  return (data || []).map((item: any) => item.appointment_time || item.date.split(' | ')[1]);
};

/**
 * Membuat appointment baru.
 */
export const createAppointment = async (payload: {
  user_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  appointment_date: string;
  appointment_time: string;
  symptoms: string;
}): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .insert([{ ...payload, status: 'pending' }]);

  if (error?.code === '23505') {
    throw new Error('Slot jadwal ini baru saja diambil pasien lain. Silakan pilih jam yang berbeda.');
  }

  if (error) throw error;
};

/**
 * Mengubah status appointment.
 */
export const updateAppointmentStatus = async (
  id: string,
  status: AppointmentStatus
): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Menghapus appointment secara permanen.
 */
export const deleteAppointment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);
  if (error) throw error;
};
