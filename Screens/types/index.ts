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
};

// ─── Enums & Unions ──────────────────────────────────────────────
export type AppointmentStatus = 'pending' | 'Confirmed' | 'Cancelled' | 'Selesai';
export type UserRole = 'user' | 'admin' | 'doctor';
