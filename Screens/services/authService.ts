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
 * Mendaftarkan akun baru.
 */
export const signUp = async (
  email: string,
  password: string,
  role: UserRole
): Promise<string | null> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role } },
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
 * Logout user.
 */
export const signOut = async (): Promise<void> => {
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
