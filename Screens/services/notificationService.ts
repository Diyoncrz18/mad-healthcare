/**
 * Notification Service — Abstraction layer untuk tabel `notifications`.
 *
 * Notifikasi dibuat OTOMATIS via trigger di Supabase saat:
 *   - INSERT appointment → dokter dapat notif "Permintaan Konsultasi Baru"
 *   - UPDATE status → pasien dapat notif "Dikonfirmasi/Dibatalkan/Selesai"
 *
 * Service ini hanya membaca + mark-as-read, TIDAK pernah insert.
 */
import { supabase } from '../../supabase';

export type NotificationType = 'appointment' | 'system' | 'success';

export type Notification = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  related_appointment_id: string | null;
  created_at: string;
};

/**
 * Mengambil daftar notifikasi user yang sedang login (descending by waktu).
 */
export const fetchMyNotifications = async (
  recipientId: string
): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as Notification[]) || [];
};

/**
 * Mengambil 1 notifikasi spesifik.
 */
export const fetchNotificationById = async (
  id: string
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as Notification) || null;
};

/**
 * Tandai notifikasi sebagai sudah dibaca.
 */
export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Tandai semua notifikasi user sebagai sudah dibaca.
 */
export const markAllNotificationsRead = async (
  recipientId: string
): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', recipientId)
    .eq('is_read', false);
  if (error) throw error;
};

/**
 * Hitung jumlah notifikasi yang belum dibaca.
 */
export const countUnreadNotifications = async (
  recipientId: string
): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
};

/**
 * Format relatif waktu (Indonesia) — "10 menit lalu", "2 hari lalu", dst.
 */
export const formatRelativeTime = (iso: string): string => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '—';

  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} menit lalu`;
  if (hour < 24) return `${hour} jam lalu`;
  if (day < 7) return `${day} hari lalu`;

  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
