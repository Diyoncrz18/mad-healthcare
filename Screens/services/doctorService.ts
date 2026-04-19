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
 * Menambahkan dokter baru.
 */
export const createDoctor = async (
  name: string,
  specialty: string,
  userId: string
): Promise<void> => {
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
