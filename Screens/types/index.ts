/**
 * Shared TypeScript type definitions untuk seluruh Screen.
 */

// ─── Database Models ─────────────────────────────────────────────
export type Doctor = {
  id: string;
  user_id?: string | null;
  name: string;
  specialty: string;
  is_active: boolean;
  created_at: string;
};

export type Appointment = {
  id: string;
  user_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  appointment_date?: string;
  appointment_time?: string;
  symptoms: string;
  status: AppointmentStatus;
  created_at: string;
  consultation_note?: string | null;
  consultation_fee?: number | null;
  processing_started_at?: string | null;
  completed_at?: string | null;
};

export type PatientProfile = {
  user_id: string;
  email: string;
  display_name: string | null;
  phone?: string | null;
  created_at?: string;
};

export type ChatConversation = {
  id: string;
  patient_id: string;
  doctor_id: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  /** ISO timestamp ketika lawan membaca pesan ini. null = belum dibaca. */
  read_at?: string | null;
};

export type ChatContact = {
  id: string;
  userId: string;
  name: string;
  subtitle: string;
  role: 'user' | 'doctor';
};

export type ChatConversationListItem = ChatConversation & {
  contactName: string;
  contactSubtitle: string;
  /** auth.users.id dari lawan bicara (untuk presence). */
  contactUserId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSenderId: string | null;
  /** Jumlah pesan yang belum dibaca oleh user saat ini. */
  unreadCount: number;
};

// ─── Enums & Unions ──────────────────────────────────────────────
export type AppointmentStatus = 'pending' | 'Confirmed' | 'Diproses' | 'Cancelled' | 'Selesai';
export type UserRole = 'user' | 'admin' | 'doctor';
