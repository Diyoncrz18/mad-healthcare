import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import {
  ChatContact,
  ChatConversation,
  ChatConversationListItem,
  ChatMessage,
  Doctor,
  UserRole,
} from '../types';
import { getCurrentUser } from './authService';
import { getDefaultBackendUrl, resolveBackendUrl } from './backendUrl';

/**
 * Status appointment yang dianggap "valid" untuk kontak chat dokter.
 * Pasien boleh memulai chat ke semua dokter aktif, sedangkan portal dokter
 * tetap menampilkan pasien dari appointment agar direktori pasien tidak bocor.
 */
const VALID_APPOINTMENT_STATUSES = ['pending', 'Confirmed', 'Diproses', 'Selesai'];

const CHAT_BACKEND_URL = resolveBackendUrl(
  (process.env.EXPO_PUBLIC_HEALTHBOT_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_SOCKET_URL as string | undefined),
  getDefaultBackendUrl()
);

export const getCurrentDoctorProfile = async (): Promise<Doctor | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as Doctor | null) || null;
};

/**
 * Daftar kontak chat.
 *
 * - Pasien: ambil semua dokter aktif yang punya akun chat.
 * - Dokter: ambil pasien unik yang pernah/akan datang ke jadwalnya.
 *
 * Dengan ini badge "Aktif" pada dokter konsisten dengan tombol chat.
 * Direktori pasien tetap dibatasi untuk dokter.
 */
export const fetchChatContacts = async (role: UserRole): Promise<ChatContact[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  if (role === 'user') {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, user_id, name, specialty')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return ((data as any[]) || [])
      .filter((doc) => !!doc.user_id)
      .map((doc) => ({
        id: doc.id,
        userId: doc.user_id,
        name: doc.name || 'Dokter',
        subtitle: doc.specialty || 'Dokter',
        role: 'doctor',
      }));
  }

  if (role === 'doctor') {
    const doctor = await getCurrentDoctorProfile();
    if (!doctor) return [];

    const { data, error } = await supabase
      .from('appointments')
      .select('user_id, patient_name')
      .eq('doctor_id', doctor.id)
      .in('status', VALID_APPOINTMENT_STATUSES);

    if (error) throw error;

    const seen = new Map<string, ChatContact>();
    for (const row of (data as any[]) || []) {
      const uid: string | null = row.user_id || null;
      if (!uid || seen.has(uid)) continue;
      seen.set(uid, {
        id: uid,
        userId: uid,
        name: row.patient_name || 'Pasien',
        subtitle: 'Pasien',
        role: 'user',
      });
    }
    return Array.from(seen.values());
  }

  return [];
};

const fetchExistingConversation = async (
  patientId: string,
  doctorId: string
): Promise<ChatConversation | null> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('patient_id', patientId)
    .eq('doctor_id', doctorId)
    .maybeSingle();

  if (error) throw error;
  return (data as ChatConversation | null) || null;
};

const fetchDoctorForChat = async (doctorId: string): Promise<ChatContact | null> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, user_id, name, specialty, is_active')
    .eq('id', doctorId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.is_active === false) {
    throw new Error('Dokter sedang tidak aktif untuk konsultasi chat.');
  }
  if (!data.user_id) {
    throw new Error('Akun chat dokter ini belum terhubung.');
  }

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name || 'Dokter',
    subtitle: data.specialty || 'Dokter',
    role: 'doctor',
  };
};

export const fetchChatContactByDoctorId = async (
  doctorId: string
): Promise<ChatContact | null> => fetchDoctorForChat(doctorId);

export const fetchChatContactByPatientId = async (
  patientId: string
): Promise<ChatContact | null> => {
  const { data, error } = await supabase
    .from('patient_profiles')
    .select('user_id, display_name, email')
    .eq('user_id', patientId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      id: patientId,
      userId: patientId,
      name: 'Pasien',
      subtitle: 'Pasien',
      role: 'user',
    };
  }

  return {
    id: data.user_id,
    userId: data.user_id,
    name: data.display_name || data.email?.split('@')[0] || 'Pasien',
    subtitle: data.email || 'Pasien',
    role: 'user',
  };
};

const createConversationViaBackend = async (
  patientId: string,
  doctorId: string
): Promise<ChatConversation> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login ulang.');

  const response = await fetch(`${CHAT_BACKEND_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ patientId, doctorId }),
  });

  const body = await response.json().catch(() => ({} as any));
  if (!response.ok || !body?.conversation) {
    throw new Error(
      body?.message ||
        body?.error ||
        'Server chat belum bisa membuat percakapan. Pastikan backend berjalan.'
    );
  }

  return body.conversation as ChatConversation;
};

const createConversationDirectly = async (
  patientId: string,
  doctorId: string
): Promise<ChatConversation> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert([{ patient_id: patientId, doctor_id: doctorId }])
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data as ChatConversation;
};

export const getOrCreateConversation = async (
  patientId: string,
  doctorId: string
): Promise<ChatConversation> => {
  const existing = await fetchExistingConversation(patientId, doctorId);
  if (existing) return existing;

  await fetchDoctorForChat(doctorId);

  try {
    return await createConversationViaBackend(patientId, doctorId);
  } catch (backendError: any) {
    try {
      return await createConversationDirectly(patientId, doctorId);
    } catch {
      throw backendError;
    }
  }
};

// ─── Internal: row dari view chat_conversation_summaries ────────
type ConversationSummaryRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  created_at: string;
  updated_at: string;
  last_message_id: string | null;
  last_sender_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_read_at: string | null;
  unread_for_patient: number;
  unread_for_doctor: number;
};

export const fetchConversations = async (
  role: UserRole
): Promise<ChatConversationListItem[]> => {
  const user = await getCurrentUser();
  if (!user || role === 'admin') return [];

  let summaries: ConversationSummaryRow[] = [];
  let usedSummary = true;

  // Coba pakai view ringkas dulu (single roundtrip + unread counter).
  try {
    let q = supabase
      .from('chat_conversation_summaries')
      .select('*')
      .order('updated_at', { ascending: false });

    if (role === 'doctor') {
      const doctor = await getCurrentDoctorProfile();
      if (!doctor) return [];
      q = q.eq('doctor_id', doctor.id);
    } else {
      q = q.eq('patient_id', user.id);
    }

    const { data, error } = await q;
    if (error) throw error;
    summaries = (data || []) as ConversationSummaryRow[];
  } catch {
    // ── Fallback: kalau view belum di-migrate, ambil tabel mentah ──
    usedSummary = false;
    let q = supabase
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (role === 'doctor') {
      const doctor = await getCurrentDoctorProfile();
      if (!doctor) return [];
      q = q.eq('doctor_id', doctor.id);
    } else {
      q = q.eq('patient_id', user.id);
    }

    const { data, error } = await q;
    if (error) throw error;
    summaries = ((data as ChatConversation[]) || []).map((c) => ({
      ...c,
      last_message_id: null,
      last_sender_id: null,
      last_message: null,
      last_message_at: null,
      last_message_read_at: null,
      unread_for_patient: 0,
      unread_for_doctor: 0,
    }));
  }

  const contacts = await fetchChatContacts(role);

  // Jika pakai fallback (tanpa view), ambil last message manual sekali.
  const fallbackLasts: Record<string, ChatMessage | null> = {};
  if (!usedSummary && summaries.length > 0) {
    const ids = summaries.map((s) => s.id);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false });
    if (!error && data) {
      for (const m of data as ChatMessage[]) {
        if (!fallbackLasts[m.conversation_id]) fallbackLasts[m.conversation_id] = m;
      }
    }
  }

  return summaries.map((s) => {
    const contact =
      role === 'doctor'
        ? contacts.find((c) => c.userId === s.patient_id)
        : contacts.find((c) => c.id === s.doctor_id);

    const fb = fallbackLasts[s.id] || null;
    const lastMessage = s.last_message ?? fb?.message ?? null;
    const lastMessageAt = s.last_message_at ?? fb?.created_at ?? null;
    const lastSenderId = s.last_sender_id ?? fb?.sender_id ?? null;

    return {
      id: s.id,
      patient_id: s.patient_id,
      doctor_id: s.doctor_id,
      created_at: s.created_at,
      updated_at: s.updated_at,
      contactName: contact?.name || 'Kontak',
      contactSubtitle:
        contact?.subtitle || (role === 'doctor' ? 'Pasien' : 'Dokter'),
      contactUserId: contact?.userId || null,
      lastMessage,
      lastMessageAt,
      lastSenderId,
      unreadCount:
        role === 'doctor' ? s.unread_for_doctor || 0 : s.unread_for_patient || 0,
    };
  });
};

export const fetchMessages = async (conversationId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as ChatMessage[]) || [];
};

/**
 * REST fallback sendMessage — dipakai bila Socket.IO tidak tersedia.
 * Path utama: pakai `socketService.sendMessageRT`.
 */
export const sendMessage = async (
  conversationId: string,
  message: string
): Promise<void> => {
  const text = message.trim();
  if (!text) throw new Error('Pesan tidak boleh kosong.');

  const user = await getCurrentUser();
  if (!user) throw new Error('Anda harus login untuk mengirim pesan.');

  const { error } = await supabase
    .from('chat_messages')
    .insert([{ conversation_id: conversationId, sender_id: user.id, message: text }]);

  if (error) throw error;
};

/**
 * Tandai semua pesan di percakapan ini (yang dikirim oleh lawan)
 * sebagai sudah dibaca. REST fallback untuk `socketService.markMessagesRead`.
 */
export const markConversationRead = async (conversationId: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  await supabase
    .from('chat_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
};

// ─────────────────────────────────────────────────────────────────
// Hook: total pesan belum dibaca (untuk badge tab "Pesan")
// ─────────────────────────────────────────────────────────────────

/**
 * Hitung total pesan belum dibaca untuk role saat ini.
 * Sumber data: `chat_conversation_summaries` view (sudah diisi oleh migrasi
 * `2026-04-29_chat_read_receipts.sql`). Fallback ke 0 jika view tidak ada.
 */
export const fetchTotalUnreadChat = async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;
  const role = (user.user_metadata?.role || 'user') as UserRole;
  if (role === 'admin') return 0;

  // Untuk doctor kita perlu doctor_id, untuk pasien cukup user.id.
  let filter: { column: string; value: string } | null = null;
  if (role === 'doctor') {
    const doctor = await getCurrentDoctorProfile();
    if (!doctor) return 0;
    filter = { column: 'doctor_id', value: doctor.id };
  } else {
    filter = { column: 'patient_id', value: user.id };
  }

  const { data, error } = await supabase
    .from('chat_conversation_summaries')
    .select('unread_for_patient, unread_for_doctor')
    .eq(filter.column, filter.value);

  if (error || !data) return 0;
  const key = role === 'doctor' ? 'unread_for_doctor' : 'unread_for_patient';
  return data.reduce((sum: number, row: any) => sum + (row?.[key] || 0), 0);
};

/**
 * React hook: monitor jumlah unread chat untuk user/dokter aktif.
 * Re-fetch saat:
 *  - Mount
 *  - Ada INSERT/UPDATE pada `chat_messages` (via Supabase realtime).
 *  - Caller memanggil `refresh()`.
 *
 * Aman dipanggil di banyak tempat — tiap pemanggilan bikin channel baru,
 * tapi Supabase JS klien sudah dedup koneksi WebSocket-nya per project.
 */
export const useChatUnreadCount = (): { count: number; refresh: () => void } => {
  const [count, setCount] = useState(0);
  const cancelledRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const total = await fetchTotalUnreadChat();
      if (!cancelledRef.current) setCount(total);
    } catch {
      /* abaikan — biarkan badge tetap di nilai terakhir */
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();

    // Debounce untuk batch refetch saat banyak event masuk beruntun.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refresh(), 350);
    };

    const channel = supabase
      .channel('chat-unread-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        debouncedRefresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        debouncedRefresh
      )
      .subscribe();

    return () => {
      cancelledRef.current = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { count, refresh };
};
