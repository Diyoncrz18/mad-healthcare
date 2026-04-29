/**
 * Doctor Service — Abstraction layer untuk operasi CRUD tabel `doctors`.
 */
import { supabase } from '../../supabase';
import { Doctor } from '../types';

/**
 * Mengambil seluruh daftar dokter, diurutkan berdasarkan nama.
 */
export const fetchAllDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data as Doctor[]) || [];
};

/**
 * Mengambil daftar dokter yang aktif saja.
 */
export const fetchActiveDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data as Doctor[]) || [];
};

/**
 * Toggle status aktif/libur dokter.
 */
export const toggleDoctorStatus = async (
  id: string,
  currentStatus: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('doctors')
    .update({ is_active: !currentStatus })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Memastikan dokter dengan `userId` tertentu ada di tabel `doctors`.
 *
 * Idempotent — aman dijalankan baik dengan maupun tanpa trigger
 * `handle_new_doctor()` (lihat migrasi 2026-04-28). Bila trigger sudah membuat
 * baris dengan default value, fungsi ini akan menimpanya dengan nama dan
 * spesialisasi yang dimasukkan admin.
 *
 *   - Sudah ada (via trigger)   → UPDATE name & specialty.
 *   - Belum ada (no trigger)    → INSERT baris baru.
 */
export const createDoctor = async (
  name: string,
  specialty: string,
  userId: string
): Promise<void> => {
  const { data: existing, error: selectError } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from('doctors')
      .update({ name, specialty, is_active: true })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('doctors')
    .insert([{ name, specialty, is_active: true, user_id: userId }]);
  if (error) throw error;
};

/**
 * Mengupdate data dokter.
 */
export const updateDoctor = async (
  id: string,
  name: string,
  specialty: string
): Promise<void> => {
  const { error } = await supabase
    .from('doctors')
    .update({ name, specialty })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Menghapus data dokter.
 */
export const deleteDoctor = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('doctors')
    .update({ is_active: false, user_id: null })
    .eq('id', id);
  if (error) throw error;
};
