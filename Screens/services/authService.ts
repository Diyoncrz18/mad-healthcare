/**
 * Auth Service — Abstraction layer untuk semua operasi autentikasi Supabase.
 */
import { Alert } from 'react-native';
import { supabase } from '../../supabase';
import { UserRole } from '../types';

/**
 * Validasi format input email dan password.
 */
export const validateAuthInput = (email: string, password: string): boolean => {
  if (!email.includes('@')) {
    Alert.alert('Invalid Input', 'Silakan masukkan email yang valid.');
    return false;
  }
  if (password.length < 6) {
    Alert.alert('Invalid Input', 'Password minimal 6 karakter.');
    return false;
  }
  return true;
};

/**
 * Login user/admin. Mengembalikan role user jika berhasil, atau null jika gagal.
 */
export const signIn = async (
  email: string,
  password: string,
  expectedRole: UserRole
): Promise<UserRole | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    let msg = 'Email atau Password yang Anda masukkan salah. Silakan periksa kembali.';
    if (expectedRole === 'admin') msg = 'Email atau Password Staff salah. Silakan periksa kembali.';
    if (expectedRole === 'doctor') msg = 'Email atau Password Dokter salah. Silakan periksa kembali.';
    Alert.alert('Gagal Masuk 🛑', msg);
    return null;
  }

  if (data.user) {
    const userRole = (data.user.user_metadata?.role || 'user') as UserRole;

    if (expectedRole !== userRole) {
      await supabase.auth.signOut();
      
      let expectedLabel = 'Pasien';
      if (expectedRole === 'admin') expectedLabel = 'Administrator';
      if (expectedRole === 'doctor') expectedLabel = 'Dokter';
      
      let currentLabel = 'Pasien';
      if (userRole === 'admin') currentLabel = 'Administrator';
      if (userRole === 'doctor') currentLabel = 'Dokter';

      Alert.alert(
        'Akses Ditolak 🛑',
        `Akun Anda terdaftar sebagai ${currentLabel}. Anda tidak memiliki akses ke portal ${expectedLabel}.`
      );
      return null;
    }

    return userRole;
  }

  return null;
};

/**
 * Metadata tambahan opsional saat registrasi.
 * - displayName : nama tampilan pengguna (untuk pasien & dokter).
 * - specialty   : spesialisasi (khusus dokter — masuk ke `doctors.specialty` via trigger).
 * - phone       : nomor telepon (khusus pasien — masuk ke `patient_profiles.phone`).
 */
export type SignUpExtras = {
  displayName?: string;
  specialty?: string;
  phone?: string;
};

/**
 * Mendaftarkan akun baru.
 *
 * Untuk role `doctor`: trigger `handle_new_doctor()` di Supabase akan otomatis
 * membuat baris di tabel `doctors` berdasarkan metadata (display_name, specialty).
 * Untuk role `user`: trigger `handle_new_user()` mengisi `patient_profiles`.
 */
export const signUp = async (
  email: string,
  password: string,
  role: UserRole,
  extras?: SignUpExtras
): Promise<string | null> => {
  const metadata: Record<string, unknown> = { role };
  if (extras?.displayName?.trim()) metadata.display_name = extras.displayName.trim();
  if (extras?.specialty?.trim()) metadata.specialty = extras.specialty.trim();
  if (extras?.phone?.trim()) metadata.phone = extras.phone.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    Alert.alert('Registrasi Gagal', error.message);
    return null;
  }

  let label = 'Pasien';
  if (role === 'admin') label = 'Admin';
  if (role === 'doctor') label = 'Dokter';

  Alert.alert('Sukses', `Akun ${label} berhasil dibuat! Silakan login.`);
  return data.user?.id || null;
};

/**
 * Logout user. Sekaligus menutup koneksi Socket.IO chat agar status
 * presence di server langsung berubah ke offline.
 */
export const signOut = async (): Promise<void> => {
  try {
    // Lazy import untuk menghindari circular dependency dengan socketService
    // (socketService memakai supabase auth untuk fetch token).
    const { disconnectSocket } = await import('./socketService');
    disconnectSocket();
  } catch {
    /* abaikan — logout tetap harus jalan */
  }
  await supabase.auth.signOut();
};

/**
 * Mengambil data user yang sedang login.
 */
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};
