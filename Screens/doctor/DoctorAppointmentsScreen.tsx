/**
 * DoctorAppointmentsScreen — Antrean & Request Pasien
 *
 * Workflow tool untuk dokter mengelola janji pasien.
 *
 * Konsep:
 *   1. Smart Banner — aksi prioritas (X permintaan baru) tappable.
 *   2. Filter Pills — chip dengan count badge embedded.
 *   3. Section Grouping — Hari Ini / Besok / Minggu Ini / Mendatang / Sebelumnya.
 *   4. Appointment Card — time prominent, avatar berwarna status,
 *      simptom inline, action contextual.
 *   5. Empty State kontekstual per filter.
 *
 * Realtime: subscribe ke INSERT pada `appointments` agar antrean
 * terus segar tanpa perlu pull-to-refresh manual.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { callPatientToRoom } from '../services/patientCallService';
import { supabase } from '../../supabase';
import {
  ScreenHeader,
  Card,
  Button,
  StatusBadge,
  InfoBanner,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/ui';
import type { StatusKind } from '../components/ui';

// ═══════════════════════════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════════════════════════
type Appointment = {
  id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  symptoms: string;
  status: string;
  created_at: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  consultation_note?: string | null;
  consultation_fee?: number | null;
  processing_started_at?: string | null;
  completed_at?: string | null;
};

type FilterKey = 'Semua' | 'pending' | 'Confirmed' | 'Diproses' | 'Selesai' | 'Cancelled';
type WorkflowStatus = Exclude<FilterKey, 'Semua'>;
type InvoiceNoteKey = 'diagnosis' | 'treatment' | 'prescription' | 'advice';
type InvoiceNoteFields = Record<InvoiceNoteKey, string>;

const EMPTY_INVOICE_FIELDS: InvoiceNoteFields = {
  diagnosis: '',
  treatment: '',
  prescription: '',
  advice: '',
};

const NOTE_SECTIONS: {
  key: InvoiceNoteKey;
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  required?: boolean;
}[] = [
    {
      key: 'diagnosis',
      label: 'Diagnosis / Kesimpulan',
      placeholder: 'Contoh: gastritis akut, demam observasi, atau hasil pemeriksaan awal.',
      icon: 'medkit-outline',
      required: true,
    },
    {
      key: 'treatment',
      label: 'Tindakan / Terapi',
      placeholder: 'Contoh: pemeriksaan fisik, edukasi pola makan, terapi simptomatik.',
      icon: 'bandage-outline',
      required: true,
    },
    {
      key: 'prescription',
      label: 'Resep / Obat',
      placeholder: 'Contoh: Paracetamol 500 mg 3x1 bila demam. Kosongkan jika tidak ada.',
      icon: 'flask-outline',
    },
    {
      key: 'advice',
      label: 'Saran / Rencana Lanjut',
      placeholder: 'Contoh: kontrol 3 hari lagi jika keluhan menetap, cukup cairan, istirahat.',
      icon: 'clipboard-outline',
    },
  ];

const FILTERS: {
  key: FilterKey;
  label: string;
  emptyTitle: string;
  emptyDesc: string;
  emptyIcon: keyof typeof Ionicons.glyphMap;
}[] = [
    {
      key: 'Semua',
      label: 'Semua',
      emptyTitle: 'Belum ada antrean',
      emptyDesc: 'Belum ada pasien yang membuat janji dengan Anda.',
      emptyIcon: 'calendar-outline',
    },
    {
      key: 'pending',
      label: 'Baru',
      emptyTitle: 'Tidak ada permintaan baru',
      emptyDesc: 'Semua permintaan pasien sudah Anda tangani. Selamat bekerja!',
      emptyIcon: 'checkmark-done-circle-outline',
    },
    {
      key: 'Confirmed',
      label: 'Dikonfirmasi',
      emptyTitle: 'Tidak ada janji aktif',
      emptyDesc: 'Belum ada janji yang sudah dikonfirmasi untuk dilaksanakan.',
      emptyIcon: 'calendar-clear-outline',
    },
    {
      key: 'Diproses',
      label: 'Diproses',
      emptyTitle: 'Belum ada konsultasi diproses',
      emptyDesc: 'Pasien yang sedang konsultasi akan muncul di tahap ini.',
      emptyIcon: 'pulse-outline',
    },
    {
      key: 'Selesai',
      label: 'Selesai',
      emptyTitle: 'Belum ada konsultasi selesai',
      emptyDesc: 'Konsultasi yang ditandai selesai akan muncul di sini.',
      emptyIcon: 'flag-outline',
    },
    {
      key: 'Cancelled',
      label: 'Dibatalkan',
      emptyTitle: 'Tidak ada pembatalan',
      emptyDesc: 'Janji yang dibatalkan oleh pasien atau dokter muncul di sini.',
      emptyIcon: 'close-circle-outline',
    },
  ];

// ── Date helpers ──────────────────────────────────────────────────
const MONTHS_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];
const DAYS_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const parseAppointmentDate = (a: Appointment): Date => {
  if (a.appointment_date) {
    const d = new Date(a.appointment_date);
    if (!isNaN(d.getTime())) return d;
  }
  const datePart = (a.date || '').split(' | ')[0];
  if (datePart) {
    const d = new Date(datePart);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(a.created_at);
};

const formatLongDate = (d: Date): string =>
  `${DAYS_SHORT_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;

const extractTime = (a: Appointment): string => {
  if (a.appointment_time) return a.appointment_time;
  const parts = (a.date || '').split(' | ');
  return parts[1] || '—';
};

const formatIDR = (value: number): string =>
  'Rp ' + Math.round(value).toLocaleString('id-ID');

const parseIDRInput = (value: string): number => {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};

const parseConsultationNote = (note?: string | null): InvoiceNoteFields => {
  const fields: InvoiceNoteFields = { ...EMPTY_INVOICE_FIELDS };
  const raw = (note || '').trim();
  if (!raw) return fields;

  let currentKey: InvoiceNoteKey | null = null;
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const section = NOTE_SECTIONS.find(
      (item) => trimmed.toLowerCase() === `${item.label}:`.toLowerCase()
    );
    if (section) {
      currentKey = section.key;
      return;
    }
    if (!currentKey || !trimmed) return;
    fields[currentKey] = fields[currentKey]
      ? `${fields[currentKey]}\n${trimmed}`
      : trimmed;
  });

  const hasStructuredValue = NOTE_SECTIONS.some((section) => fields[section.key].trim());
  if (!hasStructuredValue) {
    fields.diagnosis = raw;
  }

  return fields;
};

const composeConsultationNote = (fields: InvoiceNoteFields): string =>
  NOTE_SECTIONS.map((section) => {
    const value = fields[section.key].trim();
    return value ? `${section.label}:\n${value}` : '';
  })
    .filter(Boolean)
    .join('\n\n');

const invoicePreview = (note?: string | null): string => {
  const fields = parseConsultationNote(note);
  return (
    fields.diagnosis ||
    fields.treatment ||
    fields.prescription ||
    fields.advice ||
    'Nota belum memiliki detail.'
  );
};

const invoiceNumber = (appointment?: Appointment | null): string => {
  if (!appointment?.id) return 'CC-NOTA';
  return `CC-${appointment.id.slice(0, 8).toUpperCase()}`;
};

const completedDateLabel = (appointment?: Appointment | null): string => {
  const raw = appointment?.completed_at || appointment?.created_at;
  const date = raw ? new Date(raw) : new Date();
  return formatLongDate(isNaN(date.getTime()) ? new Date() : date);
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const htmlLines = (value?: string | null): string =>
  escapeHtml(value?.trim() || 'Tidak ada data.').replace(/\n/g, '<br/>');

const buildPrintableInvoiceHtml = (appointment: Appointment): string => {
  const fields = parseConsultationNote(appointment.consultation_note);
  const sections = NOTE_SECTIONS.map(
    (section) => `
      <section class="note-section">
        <div class="section-title">${escapeHtml(section.label)}</div>
        <div class="section-body">${htmlLines(fields[section.key])}</div>
      </section>`
  ).join('');

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Nota ${escapeHtml(invoiceNumber(appointment))}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f8fafc;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: 100%;
        max-width: 760px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #dbeafe;
        border-radius: 14px;
        overflow: hidden;
      }
      .brand {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 28px 32px 22px;
        border-bottom: 4px solid #0e7490;
      }
      .brand h1 { margin: 0; font-size: 24px; color: #164e63; }
      .brand p { margin: 6px 0 0; font-size: 12px; color: #64748b; line-height: 1.5; }
      .badge {
        text-align: right;
        font-size: 12px;
        color: #0e7490;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .badge strong {
        display: block;
        margin-top: 8px;
        color: #0f172a;
        font-size: 18px;
        letter-spacing: 0;
      }
      .content { padding: 26px 32px 30px; }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 18px;
      }
      .info {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px 14px;
        min-height: 68px;
      }
      .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; }
      .value { color: #0f172a; margin-top: 6px; font-size: 14px; line-height: 1.45; }
      .complaint {
        margin: 16px 0 18px;
        padding: 14px 16px;
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
      .note-section {
        margin-bottom: 12px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }
      .section-title {
        padding: 10px 14px;
        background: #ecfeff;
        color: #155e75;
        font-size: 12px;
        font-weight: 800;
      }
      .section-body {
        padding: 13px 14px;
        min-height: 48px;
        color: #334155;
        font-size: 13px;
        line-height: 1.6;
      }
      .total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 18px;
        padding: 16px 18px;
        border-radius: 12px;
        background: #ecfdf5;
        border: 1px solid #bbf7d0;
      }
      .total span { color: #065f46; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      .total strong { color: #064e3b; font-size: 22px; }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-top: 34px;
      }
      .signature {
        min-height: 96px;
        border-top: 1px solid #cbd5e1;
        padding-top: 10px;
        color: #334155;
        font-size: 12px;
      }
      .footer {
        padding: 14px 32px 22px;
        color: #64748b;
        font-size: 11px;
        border-top: 1px solid #e2e8f0;
      }
      @media print {
        body { background: #fff; }
        .sheet { border-radius: 0; border-color: #cbd5e1; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="brand">
        <div>
          <h1>CareConnect Clinic</h1>
          <p>Layanan reservasi dan konsultasi kesehatan.<br/>Dokumen ini diterbitkan otomatis dari sistem CareConnect.</p>
        </div>
        <div class="badge">
          Nota Konsultasi
          <strong>${escapeHtml(invoiceNumber(appointment))}</strong>
        </div>
      </header>
      <section class="content">
        <div class="grid">
          <div class="info"><div class="label">Pasien</div><div class="value">${escapeHtml(appointment.patient_name)}</div></div>
          <div class="info"><div class="label">Dokter</div><div class="value">${escapeHtml(appointment.doctor_name || 'Dokter')}</div></div>
          <div class="info"><div class="label">Jadwal</div><div class="value">${escapeHtml(formatLongDate(parseAppointmentDate(appointment)))} · ${escapeHtml(extractTime(appointment))}</div></div>
          <div class="info"><div class="label">Tanggal Nota</div><div class="value">${escapeHtml(completedDateLabel(appointment))}</div></div>
        </div>
        <div class="complaint">
          <div class="label">Keluhan Utama</div>
          <div class="value">${htmlLines(appointment.symptoms)}</div>
        </div>
        ${sections}
        <div class="total">
          <span>Total Biaya</span>
          <strong>${escapeHtml(appointment.consultation_fee ? formatIDR(appointment.consultation_fee) : 'Belum tercatat')}</strong>
        </div>
        <div class="signatures">
          <div class="signature">Pasien / Wali</div>
          <div class="signature">Dokter Pemeriksa<br/><br/><strong>${escapeHtml(appointment.doctor_name || 'Dokter')}</strong></div>
        </div>
      </section>
      <footer class="footer">
        Nota ini merupakan ringkasan konsultasi dan biaya layanan. Simpan dokumen ini sebagai arsip pasien.
      </footer>
    </main>
    <script>
      window.addEventListener('load', function () {
        window.focus();
        setTimeout(function () { window.print(); }, 250);
      });
    </script>
  </body>
</html>`;
};

const printInvoice = (appointment: Appointment | null) => {
  if (!appointment) return;

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    Alert.alert(
      'Template Siap Cetak',
      'Template nota sudah dibuat. Untuk mencetak langsung, buka aplikasi melalui browser/web lalu tekan Cetak Nota.'
    );
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) {
    Alert.alert('Cetak Diblokir', 'Izinkan pop-up browser untuk mencetak nota.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildPrintableInvoiceHtml(appointment));
  printWindow.document.close();
};

// ── Section grouping ──────────────────────────────────────────────
type SectionKey = 'today' | 'tomorrow' | 'thisWeek' | 'upcoming' | 'past';

const SECTION_LABEL: Record<SectionKey, string> = {
  today: 'Hari Ini',
  tomorrow: 'Besok',
  thisWeek: 'Minggu Ini',
  upcoming: 'Mendatang',
  past: 'Sebelumnya',
};

const SECTION_ORDER: SectionKey[] = ['today', 'tomorrow', 'thisWeek', 'upcoming', 'past'];

const sectionFor = (date: Date): SectionKey => {
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((target - today) / dayMs);

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays > 1 && diffDays <= 7) return 'thisWeek';
  if (diffDays > 7) return 'upcoming';
  return 'past';
};

// ── Status mapping ────────────────────────────────────────────────
const statusToKind = (status: string): StatusKind => {
  if (status === 'pending') return 'pending';
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Diproses') return 'processing';
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

const statusLabel = (status: string): string => {
  if (status === 'pending') return 'Baru';
  if (status === 'Confirmed') return 'Dikonfirmasi';
  if (status === 'Diproses') return 'Diproses';
  if (status === 'Selesai') return 'Selesai';
  if (status === 'Cancelled') return 'Dibatalkan';
  return status || 'Status';
};

const avatarPalette = (status: string): { bg: string; fg: string } => {
  if (status === 'pending') return { bg: COLORS.warningBg, fg: COLORS.warningText };
  if (status === 'Confirmed') return { bg: COLORS.primaryLight, fg: COLORS.primary };
  if (status === 'Diproses') return { bg: COLORS.infoBg, fg: COLORS.infoText };
  if (status === 'Selesai') return { bg: COLORS.successBg, fg: COLORS.successText };
  if (status === 'Cancelled') return { bg: COLORS.dangerBg, fg: COLORS.dangerText };
  return { bg: COLORS.borderLight, fg: COLORS.textSecondary };
};

const appointmentUpdateError = (message: string) => {
  const missingFlowMigration =
    message.includes('appointments_status_check') ||
    message.includes('processing_started_at') ||
    message.includes('consultation_note') ||
    message.includes('consultation_fee') ||
    message.includes('completed_at');

  if (!missingFlowMigration) {
    return { title: 'Error', message };
  }

  return {
    title: 'Database Belum Diupdate',
    message:
      'Flow proses dan nota membutuhkan migration terbaru. Jalankan SQL `supabase/migrations/2026-05-01_add_appointment_processing_invoice.sql` di Supabase SQL Editor, lalu refresh aplikasi.',
  };
};

// ═══════════════════════════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════════════════════════
export default function DoctorAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState<FilterKey>('Semua');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Appointment | null>(null);
  const [invoiceFields, setInvoiceFields] = useState<InvoiceNoteFields>(EMPTY_INVOICE_FIELDS);
  const [invoiceFee, setInvoiceFee] = useState('');
  const [noteDetailTarget, setNoteDetailTarget] = useState<Appointment | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [callingPatientId, setCallingPatientId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;

      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (doctorError) throw doctorError;

      if (!doctorData?.id) {
        setAppointments([]);
        setErrorMessage(
          'Akun dokter ini belum terhubung ke profil dokter. Hubungi admin untuk sinkronisasi data.'
        );
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments((data as Appointment[]) || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat antrean dokter.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const channel = supabase
      .channel('appointments-doctor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── Action handler ───────────────────────────────────────────────
  const handleAction = (
    id: string,
    newStatus: 'Confirmed' | 'Cancelled' | 'Diproses',
    patientName: string
  ) => {
    const labels: Record<string, string> = {
      Confirmed: 'Konfirmasi',
      Cancelled: 'Tolak',
      Diproses: 'Mulai Proses',
    };
    const messages: Record<string, string> = {
      Confirmed: `Konfirmasi jadwal dari ${patientName}?`,
      Cancelled: `Tolak permintaan dari ${patientName}? Pasien akan diberi tahu.`,
      Diproses: `Mulai proses konsultasi ${patientName}? Setelah diproses, dokter perlu mengisi nota dan biaya sebelum selesai.`,
    };
    Alert.alert(
      labels[newStatus],
      messages[newStatus],
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: labels[newStatus],
          style: newStatus === 'Cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingId(id);
            try {
              const updatePayload =
                newStatus === 'Diproses'
                  ? { status: newStatus, processing_started_at: new Date().toISOString() }
                  : { status: newStatus };
              const { error } = await supabase
                .from('appointments')
                .update(updatePayload)
                .eq('id', id);
              if (error) {
                const formatted = appointmentUpdateError(error.message);
                Alert.alert(formatted.title, formatted.message);
                return;
              }
              loadData();
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const openInvoiceModal = (item: Appointment) => {
    setInvoiceTarget(item);
    setInvoiceFields(parseConsultationNote(item.consultation_note));
    setInvoiceFee(
      typeof item.consultation_fee === 'number' && item.consultation_fee > 0
        ? String(Math.round(item.consultation_fee))
        : ''
    );
  };

  const handleCallPatient = (item: Appointment) => {
    Alert.alert(
      'Panggil Pasien',
      `Panggil ${item.patient_name} untuk masuk ke ruangan konsultasi?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Panggil',
          onPress: async () => {
            setCallingPatientId(item.id);
            try {
              await callPatientToRoom(item.id);
              Alert.alert(
                'Pasien Dipanggil',
                `Panggilan sudah dikirim ke HP ${item.patient_name}.`
              );
            } catch (err: any) {
              Alert.alert(
                'Gagal Memanggil Pasien',
                err.message || 'Tidak dapat mengirim panggilan pasien.'
              );
            } finally {
              setCallingPatientId(null);
            }
          },
        },
      ]
    );
  };

  const closeInvoiceModal = () => {
    if (savingInvoice) return;
    setInvoiceTarget(null);
    setInvoiceFields({ ...EMPTY_INVOICE_FIELDS });
    setInvoiceFee('');
  };

  const updateInvoiceField = (key: InvoiceNoteKey, value: string) => {
    setInvoiceFields((prev) => ({ ...prev, [key]: value }));
  };

  const submitInvoice = async () => {
    if (!invoiceTarget) return;
    const note = composeConsultationNote(invoiceFields);
    const fee = parseIDRInput(invoiceFee);

    if (!invoiceFields.diagnosis.trim()) {
      Alert.alert('Diagnosis Belum Diisi', 'Isi diagnosis atau kesimpulan konsultasi terlebih dahulu.');
      return;
    }
    if (!invoiceFields.treatment.trim()) {
      Alert.alert('Tindakan Belum Diisi', 'Isi tindakan, terapi, atau layanan yang diberikan kepada pasien.');
      return;
    }
    if (fee <= 0) {
      Alert.alert('Biaya Belum Valid', 'Masukkan biaya konsultasi lebih dari Rp 0.');
      return;
    }

    setSavingInvoice(true);
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'Selesai',
        consultation_note: note,
        consultation_fee: fee,
        completed_at: new Date().toISOString(),
      })
      .eq('id', invoiceTarget.id);
    setSavingInvoice(false);

    if (error) {
      const formatted = appointmentUpdateError(error.message);
      Alert.alert(
        formatted.title === 'Error' ? 'Gagal Menyimpan Nota' : formatted.title,
        formatted.message
      );
      return;
    }

    closeInvoiceModal();
    loadData();
  };

  // ── Derived data ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = {
      Semua: appointments.length,
      pending: 0,
      Confirmed: 0,
      Diproses: 0,
      Selesai: 0,
      Cancelled: 0,
    };
    appointments.forEach((a) => {
      if (a.status in map) (map as any)[a.status] += 1;
    });
    return map;
  }, [appointments]);

  const filtered = useMemo(
    () =>
      filter === 'Semua'
        ? appointments
        : appointments.filter((a) => a.status === filter),
    [appointments, filter]
  );

  const sections = useMemo(() => {
    const groups: Record<SectionKey, Appointment[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      upcoming: [],
      past: [],
    };

    filtered.forEach((appt) => {
      const key = sectionFor(parseAppointmentDate(appt));
      groups[key].push(appt);
    });

    SECTION_ORDER.forEach((key) => {
      groups[key].sort((a, b) => {
        const ta = parseAppointmentDate(a).getTime();
        const tb = parseAppointmentDate(b).getTime();
        // Past: terbaru → terlama (descending). Lainnya: terdekat → terjauh (ascending).
        return key === 'past' ? tb - ta : ta - tb;
      });
    });

    return SECTION_ORDER.filter((key) => groups[key].length > 0).map((key) => ({
      key,
      title: SECTION_LABEL[key],
      data: groups[key],
    }));
  }, [filtered]);

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat antrean…" />
      </SafeAreaView>
    );
  }

  const pendingCount = counts.pending;
  const headerSubtitle =
    pendingCount > 0
      ? `${pendingCount} permintaan baru menunggu konfirmasi.`
      : 'Kelola jadwal konsultasi harian Anda.';

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Antrean & Request" subtitle={headerSubtitle} />

      {/* Filter Pills */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            const count = counts[f.key] ?? 0;
            return (
              <TouchableOpacity
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {f.label}
                </Text>
                <View
                  style={[styles.chipBadge, active && styles.chipBadgeActive]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      active && styles.chipBadgeTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Smart Banner (only show if pending exists & not already filtered) */}
      {pendingCount > 0 && filter !== 'pending' && (
        <View style={styles.bannerWrap}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setFilter('pending')}
            accessibilityRole="button"
            accessibilityLabel={`Tinjau ${pendingCount} permintaan baru`}
          >
            <InfoBanner
              tone="warning"
              icon="notifications"
              title={`${pendingCount} Permintaan Baru`}
              message="Tap untuk meninjau dan konfirmasi permintaan pasien."
            />
          </TouchableOpacity>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.bannerWrap}>
          <ErrorState message={errorMessage} onRetry={loadData} />
        </View>
      )}

      {/* Section List */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentCard
            item={item}
            processingId={processingId}
            callingPatientId={callingPatientId}
            onAction={handleAction}
            onCallPatient={handleCallPatient}
            onOpenInvoice={openInvoiceModal}
            onOpenNoteDetail={setNoteDetailTarget}
          />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.data.length} />
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={() => {
          const meta = FILTERS.find((f) => f.key === filter)!;
          return (
            <EmptyState
              icon={meta.emptyIcon}
              title={meta.emptyTitle}
              description={meta.emptyDesc}
            />
          );
        }}
      />

      <InvoiceModal
        visible={!!invoiceTarget}
        appointment={invoiceTarget}
        fields={invoiceFields}
        fee={invoiceFee}
        saving={savingInvoice}
        onChangeField={updateInvoiceField}
        onChangeFee={setInvoiceFee}
        onClose={closeInvoiceModal}
        onSubmit={submitInvoice}
      />
      <InvoiceDetailModal
        visible={!!noteDetailTarget}
        appointment={noteDetailTarget}
        onClose={() => setNoteDetailTarget(null)}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════
const SectionHeader = ({
  title,
  count,
}: {
  title: string;
  count: number;
}) => (
  <View style={styles.sectionHead}>
    <View style={styles.sectionLine} />
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCountPill}>
      <Text style={styles.sectionCountText}>{count}</Text>
    </View>
    <View style={styles.sectionLineRight} />
  </View>
);

const AppointmentCard = ({
  item,
  processingId,
  callingPatientId,
  onAction,
  onCallPatient,
  onOpenInvoice,
  onOpenNoteDetail,
}: {
  item: Appointment;
  processingId: string | null;
  callingPatientId: string | null;
  onAction: (
    id: string,
    newStatus: 'Confirmed' | 'Cancelled' | 'Diproses',
    patientName: string
  ) => void;
  onCallPatient: (item: Appointment) => void;
  onOpenInvoice: (item: Appointment) => void;
  onOpenNoteDetail: (item: Appointment) => void;
}) => {
  const isPending = item.status === 'pending';
  const isConfirmed = item.status === 'Confirmed';
  const isProcessing = item.status === 'Diproses';
  const isCompleted = item.status === 'Selesai';
  const isBusy = processingId === item.id;
  const isCalling = callingPatientId === item.id;

  const time = extractTime(item);
  const dateStr = formatLongDate(parseAppointmentDate(item));
  const palette = avatarPalette(item.status);
  const notePreview = invoicePreview(item.consultation_note);

  return (
    <Card variant="default" padding="lg" style={styles.cardSpacing}>
      {/* Top: Time + Status */}
      <View style={styles.cardTop}>
        <View style={styles.timeBadge}>
          <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          <Text style={styles.timeBadgeText}>{time}</Text>
        </View>
        <StatusBadge kind={statusToKind(item.status)} label={statusLabel(item.status)} />
      </View>

      <WorkflowStepper status={item.status} />

      {/* Patient Info */}
      <View style={styles.patientRow}>
        <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
          <Text style={[styles.avatarText, { color: palette.fg }]}>
            {item.patient_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName} numberOfLines={1}>
            {item.patient_name}
          </Text>
          <Text style={styles.patientDate} numberOfLines={1}>
            {dateStr}
          </Text>
        </View>
      </View>

      {/* Symptoms */}
      <View style={styles.symptomBox}>
        <View style={styles.symptomHead}>
          <Ionicons name="document-text-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.symptomLabel}>Keluhan Utama</Text>
        </View>
        <Text style={styles.symptomText} numberOfLines={3}>
          {item.symptoms || '—'}
        </Text>
      </View>

      {/* Actions */}
      {isPending && (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button
              label="Tolak"
              onPress={() => onAction(item.id, 'Cancelled', item.patient_name)}
              variant="outline"
              icon="close"
              iconPosition="left"
              size="md"
              fullWidth
              loading={isBusy}
              disabled={isBusy}
              textStyle={{ color: COLORS.danger }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              label="Konfirmasi"
              onPress={() => onAction(item.id, 'Confirmed', item.patient_name)}
              variant="success"
              icon="checkmark"
              iconPosition="left"
              size="md"
              fullWidth
              loading={isBusy}
              disabled={isBusy}
            />
          </View>
        </View>
      )}

      {isConfirmed && (
        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => onCallPatient(item)}
            disabled={isBusy || isCalling}
            style={[
              styles.callIconButton,
              (isBusy || isCalling) && styles.callIconButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Panggil ${item.patient_name}`}
          >
            {isCalling ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="volume-high" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
          <View style={styles.startProcessButton}>
            <Button
              label="Mulai Proses"
              onPress={() => onAction(item.id, 'Diproses', item.patient_name)}
              variant="primary"
              icon="play"
              iconPosition="left"
              size="md"
              fullWidth
              loading={isBusy}
              disabled={isBusy || isCalling}
            />
          </View>
        </View>
      )}

      {isProcessing && (
        <Button
          label="Input Nota & Biaya"
          onPress={() => onOpenInvoice(item)}
          variant="success"
          icon="receipt"
          iconPosition="left"
          size="md"
          fullWidth
        />
      )}

      {isCompleted && (
        <View style={styles.invoiceSummary}>
          <View style={styles.invoiceSummaryHead}>
            <View style={styles.invoiceSummaryIcon}>
              <Ionicons name="receipt-outline" size={16} color={COLORS.successText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceSummaryTitle}>Nota Konsultasi</Text>
              {!!item.completed_at && (
                <Text style={styles.invoiceSummaryMeta}>
                  Selesai {formatLongDate(new Date(item.completed_at))}
                </Text>
              )}
            </View>
            {!!item.consultation_fee && (
              <Text style={styles.invoiceFeeText}>{formatIDR(item.consultation_fee)}</Text>
            )}
          </View>
          {!!item.consultation_note && (
            <Text style={styles.invoiceNoteText} numberOfLines={3}>
              {notePreview}
            </Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpenNoteDetail(item)}
            style={styles.invoiceDetailButton}
            accessibilityRole="button"
            accessibilityLabel={`Lihat detail nota ${item.patient_name}`}
          >
            <Text style={styles.invoiceDetailButtonText}>Lihat Detail Nota</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.successText} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
};

const WORKFLOW_STEPS: {
  key: WorkflowStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
    { key: 'pending', label: 'Request', icon: 'mail-unread-outline' },
    { key: 'Confirmed', label: 'Konfirmasi', icon: 'checkmark-circle-outline' },
    { key: 'Diproses', label: 'Proses', icon: 'pulse-outline' },
    { key: 'Selesai', label: 'Nota', icon: 'receipt-outline' },
  ];

const WorkflowStepper = ({ status }: { status: string }) => {
  if (status === 'Cancelled') {
    return (
      <View style={styles.cancelledFlow}>
        <Ionicons name="close-circle-outline" size={16} color={COLORS.dangerText} />
        <Text style={styles.cancelledFlowText}>Permintaan dibatalkan</Text>
      </View>
    );
  }

  const activeIndex = Math.max(
    0,
    WORKFLOW_STEPS.findIndex((step) => step.key === status)
  );

  return (
    <View style={styles.flowBox}>
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.flowStep}>
              <View
                style={[
                  styles.flowDot,
                  done && styles.flowDotDone,
                  active && styles.flowDotActive,
                ]}
              >
                <Ionicons
                  name={done ? 'checkmark' : step.icon}
                  size={13}
                  color={done || active ? COLORS.textOnPrimary : COLORS.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.flowStepText,
                  (done || active) && styles.flowStepTextActive,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
            {index < WORKFLOW_STEPS.length - 1 && (
              <View
                style={[
                  styles.flowConnector,
                  index < activeIndex && styles.flowConnectorDone,
                  { backgroundColor: index < activeIndex ? COLORS.primary : COLORS.border },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const InvoiceModal = ({
  visible,
  appointment,
  fields,
  fee,
  saving,
  onChangeField,
  onChangeFee,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  appointment: Appointment | null;
  fields: InvoiceNoteFields;
  fee: string;
  saving: boolean;
  onChangeField: (key: InvoiceNoteKey, value: string) => void;
  onChangeFee: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const feeValue = parseIDRInput(fee);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHead}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalEyebrow}>Tahap Akhir</Text>
              <Text style={styles.modalTitle}>Input Nota & Biaya</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={saving}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Tutup modal nota"
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!!appointment && (
              <View style={styles.modalPatientStrip}>
                <View style={styles.modalPatientIcon}>
                  <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalPatientName} numberOfLines={1}>
                    {appointment.patient_name}
                  </Text>
                  <Text style={styles.modalPatientMeta} numberOfLines={1}>
                    {formatLongDate(parseAppointmentDate(appointment))} • {extractTime(appointment)}
                  </Text>
                </View>
              </View>
            )}

            {NOTE_SECTIONS.map((section) => (
              <View key={section.key} style={styles.fieldGroup}>
                <View style={styles.inputLabelRow}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name={section.icon} size={15} color={COLORS.primary} />
                  </View>
                  <Text style={styles.inputLabel}>
                    {section.label}
                    {section.required ? ' *' : ''}
                  </Text>
                </View>
                <TextInput
                  value={fields[section.key]}
                  onChangeText={(value) => onChangeField(section.key, value)}
                  placeholder={section.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={[
                    styles.noteInput,
                    section.key === 'prescription' && styles.noteInputCompact,
                  ]}
                />
              </View>
            ))}

            <View style={styles.fieldGroup}>
              <View style={styles.inputLabelRow}>
                <View style={styles.inputIconWrap}>
                  <Ionicons name="cash-outline" size={15} color={COLORS.primary} />
                </View>
                <Text style={styles.inputLabel}>Biaya Konsultasi *</Text>
              </View>
              <View style={styles.currencyInputWrap}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  value={fee}
                  onChangeText={onChangeFee}
                  placeholder="150000"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  style={styles.feeInput}
                />
              </View>
              <Text style={styles.feePreview}>
                {feeValue > 0 ? formatIDR(feeValue) : 'Masukkan nominal tanpa titik atau koma'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              label="Batal"
              onPress={onClose}
              variant="outline"
              size="md"
              disabled={saving}
              style={styles.modalActionButton}
            />
            <Button
              label="Selesaikan"
              onPress={onSubmit}
              variant="success"
              icon="checkmark-done"
              iconPosition="left"
              size="md"
              loading={saving}
              style={styles.modalActionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const InvoiceDetailModal = ({
  visible,
  appointment,
  onClose,
}: {
  visible: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}) => {
  const fields = parseConsultationNote(appointment?.consultation_note);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHead}>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalEyebrow}>Nota Selesai</Text>
              <Text style={styles.modalTitle}>Detail Konsultasi</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Tutup detail nota"
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!!appointment && (
              <InvoicePrintTemplate appointment={appointment} fields={fields} />
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              label="Tutup"
              onPress={onClose}
              variant="outline"
              size="md"
              style={styles.modalActionButton}
            />
            <Button
              label="Cetak Nota"
              onPress={() => printInvoice(appointment)}
              variant="primary"
              icon="print"
              iconPosition="left"
              size="md"
              style={styles.modalActionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const InvoicePrintTemplate = ({
  appointment,
  fields,
}: {
  appointment: Appointment;
  fields: InvoiceNoteFields;
}) => (
  <View style={styles.printSheet}>
    <View style={styles.printHeader}>
      <View style={styles.printBrandBlock}>
        <View style={styles.printLogoMark}>
          <Ionicons name="medical" size={22} color={COLORS.textOnPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.printClinicName}>CareConnect Clinic</Text>
          <Text style={styles.printClinicMeta}>
            Layanan reservasi dan konsultasi kesehatan
          </Text>
        </View>
      </View>
      <View style={styles.printInvoiceBadge}>
        <Text style={styles.printInvoiceLabel}>Nota Konsultasi</Text>
        <Text style={styles.printInvoiceNo}>{invoiceNumber(appointment)}</Text>
      </View>
    </View>

    <View style={styles.printMetaGrid}>
      <PrintMeta label="Pasien" value={appointment.patient_name} />
      <PrintMeta label="Dokter" value={appointment.doctor_name || 'Dokter'} />
      <PrintMeta
        label="Jadwal"
        value={`${formatLongDate(parseAppointmentDate(appointment))} • ${extractTime(appointment)}`}
      />
      <PrintMeta label="Tanggal Nota" value={completedDateLabel(appointment)} />
    </View>

    <View style={styles.printComplaintBox}>
      <Text style={styles.printSectionLabel}>Keluhan Utama</Text>
      <Text style={styles.printBodyText}>{appointment.symptoms || 'Tidak ada data.'}</Text>
    </View>

    {NOTE_SECTIONS.map((section) => {
      const value = fields[section.key].trim();
      return (
        <View key={section.key} style={styles.printNoteSection}>
          <View style={styles.printNoteHead}>
            <View style={styles.printNoteIcon}>
              <Ionicons name={section.icon} size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.printNoteTitle}>{section.label}</Text>
          </View>
          <Text style={styles.printBodyText}>{value || 'Tidak ada data.'}</Text>
        </View>
      );
    })}

    <View style={styles.printTotalRow}>
      <Text style={styles.printTotalLabel}>Total Biaya</Text>
      <Text style={styles.printTotalValue}>
        {appointment.consultation_fee
          ? formatIDR(appointment.consultation_fee)
          : 'Belum tercatat'}
      </Text>
    </View>

    <View style={styles.printSignatureRow}>
      <View style={styles.printSignatureBox}>
        <View style={styles.printSignatureLine} />
        <Text style={styles.printSignatureLabel}>Pasien / Wali</Text>
      </View>
      <View style={styles.printSignatureBox}>
        <View style={styles.printSignatureLine} />
        <Text style={styles.printSignatureLabel}>Dokter Pemeriksa</Text>
        <Text style={styles.printSignatureName}>{appointment.doctor_name || 'Dokter'}</Text>
      </View>
    </View>

    <Text style={styles.printFooterText}>
      Nota ini diterbitkan otomatis dari sistem CareConnect dan siap digunakan sebagai arsip konsultasi pasien.
    </Text>
  </View>
);

const PrintMeta = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.printMetaCell}>
    <Text style={styles.printMetaLabel}>{label}</Text>
    <Text style={styles.printMetaValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Filter
  filterWrap: { marginBottom: SPACING.md },
  filterList: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: { ...TYPO.labelSm, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.textOnPrimary },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText: { ...TYPO.caption, color: COLORS.textMuted, fontWeight: '700' },
  chipBadgeTextActive: { color: COLORS.textOnPrimary },

  bannerWrap: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },

  // List
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
  },

  // Section header
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  sectionLine: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  sectionLineRight: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: SPACING.xs,
  },
  sectionTitle: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  sectionCountPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  sectionCountText: {
    ...TYPO.caption,
    color: COLORS.primary,
    fontWeight: '800',
  },

  // Card
  cardSpacing: { marginBottom: SPACING.md },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.pill,
  },
  timeBadgeText: {
    ...TYPO.label,
    color: COLORS.primary,
    fontSize: 13,
  },

  // Patient
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...TYPO.h2,
    fontSize: 20,
  },
  patientName: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  patientDate: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Symptom
  symptomBox: {
    backgroundColor: COLORS.backgroundAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: 6,
  },
  symptomHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symptomLabel: {
    ...TYPO.overline,
    color: COLORS.textMuted,
  },
  symptomText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Workflow
  flowBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },
  flowStep: {
    width: 58,
    alignItems: 'center',
    gap: 6,
  },
  flowDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flowDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  flowDotDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  flowConnector: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginTop: 12,
  },
  flowConnectorDone: {
    backgroundColor: COLORS.primary,
  },
  flowStepText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  flowStepTextActive: {
    color: COLORS.primary,
  },
  cancelledFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBg,
    marginBottom: SPACING.lg,
  },
  cancelledFlowText: {
    ...TYPO.labelSm,
    color: COLORS.dangerText,
  },

  // Invoice
  invoiceSummary: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.successBg,
    gap: SPACING.sm,
  },
  invoiceSummaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  invoiceSummaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.successBg,
  },
  invoiceSummaryTitle: {
    ...TYPO.label,
    color: COLORS.successText,
  },
  invoiceSummaryMeta: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  invoiceFeeText: {
    ...TYPO.label,
    color: COLORS.successText,
  },
  invoiceNoteText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  invoiceDetailButton: {
    minHeight: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.successBg,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  invoiceDetailButtonText: {
    ...TYPO.labelSm,
    color: COLORS.successText,
    fontWeight: '800',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    maxHeight: '92%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.lg,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalTitleWrap: {
    flex: 1,
  },
  modalEyebrow: {
    ...TYPO.overline,
    color: COLORS.primary,
  },
  modalTitle: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundAlt,
  },
  modalPatientStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.lg,
  },
  modalPatientIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  modalPatientName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
  },
  modalPatientMeta: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    paddingBottom: SPACING.sm,
  },
  fieldGroup: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  inputLabel: {
    ...TYPO.labelSm,
    color: COLORS.textPrimary,
  },
  noteInput: {
    minHeight: 112,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    color: COLORS.textPrimary,
    ...TYPO.bodySm,
    lineHeight: 20,
  },
  noteInputCompact: {
    minHeight: 82,
  },
  currencyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: SPACING.md,
    minHeight: 50,
  },
  currencyPrefix: {
    ...TYPO.label,
    color: COLORS.primary,
    marginRight: SPACING.sm,
  },
  feeInput: {
    flex: 1,
    color: COLORS.textPrimary,
    ...TYPO.body,
  },
  feePreview: {
    ...TYPO.caption,
    color: COLORS.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalActionButton: {
    flex: 1,
  },

  // Detail nota
  printSheet: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  printHeader: {
    padding: SPACING.lg,
    borderBottomWidth: 4,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  printBrandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  printLogoMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  printClinicName: {
    ...TYPO.h3,
    color: COLORS.textBrandDeep,
  },
  printClinicMeta: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  printInvoiceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.infoBorder,
  },
  printInvoiceLabel: {
    ...TYPO.overline,
    color: COLORS.primary,
  },
  printInvoiceNo: {
    ...TYPO.label,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  printMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  printMetaCell: {
    width: '48%',
    minHeight: 70,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  printMetaLabel: {
    ...TYPO.overline,
    color: COLORS.textMuted,
  },
  printMetaValue: {
    ...TYPO.bodySm,
    color: COLORS.textPrimary,
    marginTop: 6,
    lineHeight: 20,
  },
  printComplaintBox: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundAlt,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  printSectionLabel: {
    ...TYPO.overline,
    color: COLORS.textMuted,
  },
  printBodyText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  printNoteSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  printNoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
  },
  printNoteIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  printNoteTitle: {
    ...TYPO.labelSm,
    color: COLORS.primary,
  },
  printTotalRow: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.successBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  printTotalLabel: {
    ...TYPO.overline,
    color: COLORS.successText,
  },
  printTotalValue: {
    ...TYPO.h3,
    color: COLORS.successText,
  },
  printSignatureRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  printSignatureBox: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'flex-end',
  },
  printSignatureLine: {
    height: 1,
    backgroundColor: COLORS.borderStrong,
    marginBottom: SPACING.sm,
  },
  printSignatureLabel: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  printSignatureName: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  printFooterText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    lineHeight: 18,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceMuted,
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.successBg,
    marginBottom: SPACING.md,
  },
  detailHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.successBg,
  },
  detailPatientName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
  },
  detailPatientMeta: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailFeeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  detailFeeLabel: {
    ...TYPO.labelSm,
    color: COLORS.textMuted,
  },
  detailFeeValue: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
  },
  detailSection: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  detailSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailSectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  detailSectionTitle: {
    ...TYPO.labelSm,
    color: COLORS.textPrimary,
  },
  detailSectionText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  callIconButton: {
    width: 52,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  callIconButtonDisabled: {
    opacity: 0.55,
  },
  startProcessButton: {
    flex: 1,
    minWidth: 138,
  },
});
