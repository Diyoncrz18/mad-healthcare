/**
 * Schedule Service — Abstraction layer untuk tabel `doctor_schedules`.
 *
 * Mengelola jadwal mingguan dokter (Senin-Minggu, jam buka/tutup).
 * day_of_week: 0=Minggu, 1=Senin, ..., 6=Sabtu (PostgreSQL convention).
 */
import { supabase } from '../../supabase';

export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  day_of_week: number; // 0=Sun ... 6=Sat
  is_active: boolean;
  start_time: string; // 'HH:MM'
  end_time: string;
  created_at: string;
  updated_at: string;
};

/**
 * Default jadwal jika doctor belum punya entry.
 * Senin-Jumat aktif, akhir pekan tutup.
 */
const DEFAULT_SCHEDULE: Omit<DoctorSchedule, 'id' | 'doctor_id' | 'created_at' | 'updated_at'>[] =
  [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    day_of_week: dow,
    is_active: dow !== 0 && dow !== 6,
    start_time: '08:00',
    end_time: dow === 5 ? '15:00' : '17:00',
  }));

/**
 * Ambil jadwal mingguan dokter. Jika belum ada, kembalikan default
 * (tidak insert otomatis — biar tampak ke UI bahwa belum di-set).
 */
export const fetchDoctorSchedule = async (
  doctorId: string
): Promise<DoctorSchedule[]> => {
  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('day_of_week');

  if (error) throw error;

  const list = (data as DoctorSchedule[]) || [];
  if (list.length === 7) return list;

  // Fill missing days dengan default
  const map = new Map<number, DoctorSchedule>(list.map((s) => [s.day_of_week, s]));
  const filled: DoctorSchedule[] = [];

  for (let dow = 0; dow <= 6; dow++) {
    const existing = map.get(dow);
    if (existing) {
      filled.push(existing);
    } else {
      const defaults = DEFAULT_SCHEDULE.find((d) => d.day_of_week === dow)!;
      filled.push({
        id: `default-${dow}`,
        doctor_id: doctorId,
        day_of_week: dow,
        is_active: defaults.is_active,
        start_time: defaults.start_time,
        end_time: defaults.end_time,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return filled;
};

/**
 * Upsert seluruh jadwal mingguan (7 baris). Atomic per-row via unique constraint.
 *
 * Pakai loop sequential untuk maintain feedback per error,
 * tapi bisa di-optimize ke batch upsert kalau perlu.
 */
export const saveDoctorSchedule = async (
  doctorId: string,
  schedule: { day_of_week: number; is_active: boolean; start_time: string; end_time: string }[]
): Promise<void> => {
  const rows = schedule.map((s) => ({
    doctor_id: doctorId,
    day_of_week: s.day_of_week,
    is_active: s.is_active,
    start_time: s.start_time,
    end_time: s.end_time,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('doctor_schedules')
    .upsert(rows, { onConflict: 'doctor_id,day_of_week' });

  if (error) throw error;
};

/**
 * Indonesian short day labels untuk UI display.
 * Index sesuai day_of_week: 0=Min, 6=Sab.
 */
export const DAY_LABELS_FULL = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

/**
 * Urutan tampilan UI: Senin → Minggu (bukan Min → Sab).
 * Mengembalikan urutan day_of_week yang sudah disusun.
 */
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ─────────────────────────────────────────────────────────────────
// Availability helpers — dipakai untuk memblokir chat ke dokter
// yang sedang menonaktifkan jam praktik HARI INI.
//
// Konvensi:
//   - Jika tidak ada baris untuk hari ini, dianggap "default schedule"
//     (Sen-Jum aktif). Ini cocok dengan perilaku `fetchDoctorSchedule`
//     yang juga mengisi default kalau row belum ada.
// ─────────────────────────────────────────────────────────────────

/** Day-of-week JS Date.getDay() — sudah cocok dengan konvensi PostgreSQL (0=Min). */
export const getTodayDow = (): number => new Date().getDay();

const isActiveByDefault = (dow: number): boolean => dow !== 0 && dow !== 6;

/**
 * Cek satu dokter — apakah jadwal HARI INI aktif?
 * Mengembalikan true jika dokter sedang praktik (bisa dihubungi).
 */
export const isDoctorActiveToday = async (doctorId: string): Promise<boolean> => {
  if (!doctorId) return false;
  const dow = getTodayDow();
  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('is_active')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dow)
    .maybeSingle();

  if (error) {
    // Lebih aman: kalau gagal query, jangan asal block — fallback ke default.
    return isActiveByDefault(dow);
  }
  if (!data) return isActiveByDefault(dow);
  return !!data.is_active;
};

/**
 * Batch — kembalikan map { doctorId → bool } untuk daftar dokter.
 * Hemat roundtrip ketika ChatListScreen perlu mengevaluasi banyak dokter.
 */
export const fetchDoctorsActiveTodayMap = async (
  doctorIds: string[]
): Promise<Record<string, boolean>> => {
  const ids = Array.from(new Set(doctorIds.filter(Boolean)));
  if (ids.length === 0) return {};

  const dow = getTodayDow();
  const result: Record<string, boolean> = {};
  // Default semua → aktif/tidak menurut hari (mis. weekend off).
  for (const id of ids) result[id] = isActiveByDefault(dow);

  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('doctor_id, is_active')
    .in('doctor_id', ids)
    .eq('day_of_week', dow);

  if (error) return result; // fallback default
  for (const row of (data as any[]) || []) {
    if (row.doctor_id) result[row.doctor_id] = !!row.is_active;
  }
  return result;
};
