/**
 * HomeScreen — Beranda CareConnect
 *
 * Patient view (priority: surface janji aktif → discovery → support):
 *   1. Greeting Header (nama + tanggal + avatar)
 *   2. Next Appointment Card (atau empty CTA)
 *   3. Aksi Cepat (Buat Janji, Riwayat)
 *   4. Spesialisasi Klinik (horizontal scroll)
 *   5. Edukasi Kesehatan (2 tips)
 *   6. Kontak Darurat
 *
 * Admin view (priority: dashboard analitik real-time):
 *   1. Greeting Header
 *   2. Hero KPI (Total Pasien)
 *   3. Stats Grid 2×2
 *   4. Aktivitas Terbaru
 *   5. Akses Manajemen
 */
import React, { useCallback, useEffect, useState } from 'react';
import HealthcareBot from './HealthcareBot';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { Appointment, UserRole } from '../types';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import {
  Card,
  Button,
  IconBadge,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/ui';
import type { StatusKind } from '../components/ui';

// ═══════════════════════════════════════════════════════════════════
// Konstanta Konten
// ═══════════════════════════════════════════════════════════════════
const EMERGENCY_PHONE = '081244790007';
const EMERGENCY_LABEL = '0812-4479-0007';
const WA_EMERGENCY_NUMBER = '62081244790007'; // format internasional tanpa +

const SPECIALTIES: {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'doctor';
}[] = [
    { key: 'umum', name: 'Umum', icon: 'medkit', tone: 'brand' },
    { key: 'gigi', name: 'Gigi', icon: 'happy', tone: 'info' },
    { key: 'anak', name: 'Anak', icon: 'people', tone: 'success' },
    { key: 'mata', name: 'Mata', icon: 'eye', tone: 'warning' },
    { key: 'jantung', name: 'Jantung', icon: 'heart', tone: 'danger' },
    { key: 'kulit', name: 'Kulit', icon: 'hand-left', tone: 'doctor' },
  ];

const HEALTH_TIPS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  tone: 'success' | 'info' | 'warning';
}[] = [
    {
      icon: 'water-outline',
      title: 'Cukupi Hidrasi Harian',
      desc: 'Minum minimal 8 gelas air sehari menjaga fungsi ginjal dan konsentrasi.',
      tone: 'info',
    },
    {
      icon: 'fitness-outline',
      title: 'Aktif 30 Menit/Hari',
      desc: 'Olahraga ringan rutin menurunkan risiko penyakit kronis hingga 30%.',
      tone: 'success',
    },
  ];

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTHS_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

const formatDateID = (d: Date): string =>
  `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;

const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]}`;
};

const splitAppointmentDate = (
  a: Appointment
): { dateStr: string; timeStr: string } => {
  if (a.appointment_date && a.appointment_time) {
    return {
      dateStr: formatShortDate(a.appointment_date),
      timeStr: a.appointment_time,
    };
  }
  const parts = (a.date || '').split(' | ');
  return {
    dateStr: parts[0] ? formatShortDate(parts[0]) : a.date || '—',
    timeStr: parts[1] || '—',
  };
};

const sortKeyForAppointment = (a: Appointment): string =>
  a.appointment_date || (a.date || '').split(' | ')[0] || '9999-12-31';

const statusToKind = (status: string): StatusKind => {
  if (status === 'pending') return 'pending';
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════
type PatientStats = {
  total: number;
  active: number;
  completed: number;
  favoriteDoctor: string | null;
};

type AdminStats = {
  patientCount: number;
  activeDoctorCount: number;
  activeReservationCount: number;
  pendingCount: number;
  lastSyncAt: string;
};

const INITIAL_PATIENT_STATS: PatientStats = {
  total: 0,
  active: 0,
  completed: 0,
  favoriteDoctor: null,
};

const INITIAL_ADMIN_STATS: AdminStats = {
  patientCount: 0,
  activeDoctorCount: 0,
  activeReservationCount: 0,
  pendingCount: 0,
  lastSyncAt: '',
};

// ═══════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════
export default function HomeScreen({ navigation }: any) {
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Patient
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null);
  const [patientStats, setPatientStats] = useState<PatientStats>(INITIAL_PATIENT_STATS);

  // Admin
  const [adminStats, setAdminStats] = useState<AdminStats>(INITIAL_ADMIN_STATS);
  const [recentActivity, setRecentActivity] = useState<Appointment[]>([]);

  // ── Loaders ──────────────────────────────────────────────────────
  const loadPatientData = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const appts = (data as Appointment[]) || [];

    // Stats
    const total = appts.length;
    const active = appts.filter((a) => a.status === 'pending' || a.status === 'Confirmed').length;
    const completed = appts.filter((a) => a.status === 'Selesai').length;

    const freq: Record<string, number> = {};
    appts.forEach((a) => {
      if (a.doctor_name) freq[a.doctor_name] = (freq[a.doctor_name] || 0) + 1;
    });
    const sortedDoctors = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const favoriteDoctor = sortedDoctors.length > 0 ? sortedDoctors[0][0] : null;

    setPatientStats({ total, active, completed, favoriteDoctor });

    // Next appointment: filter aktif, ambil yang tanggal terdekat
    const upcoming = appts
      .filter((a) => a.status === 'pending' || a.status === 'Confirmed')
      .map((a) => ({ ...a, _sort: sortKeyForAppointment(a) }))
      .sort((a, b) => a._sort.localeCompare(b._sort));

    setNextAppt(upcoming.length > 0 ? upcoming[0] : null);
  }, []);

  const loadAdminData = useCallback(async () => {
    const [
      { data: appointments, error: appointmentsError },
      { data: doctors, error: doctorsError },
      { data: recent, error: recentError },
    ] = await Promise.all([
      supabase.from('appointments').select('user_id, status'),
      supabase.from('doctors').select('id, is_active'),
      supabase
        .from('appointments')
        .select('id, patient_name, doctor_name, status, date, created_at, user_id, doctor_id, symptoms')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (appointmentsError) throw appointmentsError;
    if (doctorsError) throw doctorsError;
    if (recentError) throw recentError;

    const uniquePatients = new Set(
      (appointments || []).map((item: any) => item.user_id).filter(Boolean)
    );
    const activeReservationCount = (appointments || []).filter(
      (item: any) => item.status === 'pending' || item.status === 'Confirmed'
    ).length;
    const pendingCount = (appointments || []).filter(
      (item: any) => item.status === 'pending'
    ).length;
    const activeDoctorCount = (doctors || []).filter((item: any) => item.is_active).length;

    setAdminStats({
      patientCount: uniquePatients.size,
      activeDoctorCount,
      activeReservationCount,
      pendingCount,
      lastSyncAt: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    setRecentActivity((recent as Appointment[]) || []);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;

      const nextRole = (user.user_metadata?.role || 'user') as UserRole;
      setEmail(user.email || '');
      setRole(nextRole);

      if (nextRole === 'admin') {
        await loadAdminData();
      } else {
        await loadPatientData(user.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data beranda.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadAdminData, loadPatientData]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Menyiapkan beranda…" />
      </SafeAreaView>
    );
  }

  const isAdmin = role === 'admin';
  const userName = email.split('@')[0] || 'Pengguna';

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          <GreetingHeader name={userName} isAdmin={isAdmin} />

          {!!errorMessage && (
            <View style={{ paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}>
              <ErrorState message={errorMessage} onRetry={loadAll} />
            </View>
          )}

          {isAdmin ? (
            <AdminView
              stats={adminStats}
              recent={recentActivity}
              onRefresh={loadAll}
              navigation={navigation}
            />
          ) : (
            <PatientView
              nextAppt={nextAppt}
              stats={patientStats}
              navigation={navigation}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* HealthcareBot Floating Chatbot (Hanya untuk Pasien) */}
      {role === 'user' && (
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: '100%', height: '100%', pointerEvents: 'box-none' }}>
          <HealthcareBot showFab={true} />
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Greeting Header
// ═══════════════════════════════════════════════════════════════════
const GreetingHeader = ({
  name,
  isAdmin,
}: {
  name: string;
  isAdmin: boolean;
}) => {
  const today = new Date();
  const hour = today.getHours();
  const greeting =
    hour < 11 ? 'Selamat pagi'
      : hour < 15 ? 'Selamat siang'
        : hour < 19 ? 'Selamat sore'
          : 'Selamat malam';

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerDate}>{formatDateID(today)}</Text>
        <Text style={styles.headerGreeting}>
          {greeting}, {name}
        </Text>
        <Text style={styles.headerSub}>
          {isAdmin
            ? 'Berikut ringkasan operasional klinik hari ini.'
            : 'Semoga harimu sehat dan berenergi 🌿'}
        </Text>
      </View>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Ionicons
              name={isAdmin ? 'shield-checkmark' : 'person'}
              size={22}
              color={COLORS.primary}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Patient View
// ═══════════════════════════════════════════════════════════════════
const PatientView = ({
  nextAppt,
  stats,
  navigation,
}: {
  nextAppt: Appointment | null;
  stats: PatientStats;
  navigation: any;
}) => {
  const handleEmergencyCall = async () => {
    const message = encodeURIComponent(
      'Halo, saya membutuhkan penanganan darurat medis segera. Mohon bantuannya! 🚨'
    );
    const waUrl = `https://wa.me/${WA_EMERGENCY_NUMBER}?text=${message}`;
    try {
      const supported = await Linking.canOpenURL(waUrl);
      if (supported) {
        await Linking.openURL(waUrl);
      } else {
        // fallback ke panggilan telepon jika WhatsApp tidak tersedia
        const telUrl = `tel:${EMERGENCY_PHONE}`;
        const telSupported = await Linking.canOpenURL(telUrl);
        if (telSupported) {
          await Linking.openURL(telUrl);
        } else {
          Alert.alert('Tidak Tersedia', 'WhatsApp atau panggilan tidak tersedia di perangkat ini.');
        }
      }
    } catch {
      Alert.alert('Gagal', 'Tidak dapat membuka WhatsApp.');
    }
  };

  return (
    <View style={styles.body}>
      {/* ── Janji Berikutnya ─────────────────────────── */}
      <SectionHeader title="Janji Berikutnya" />
      {nextAppt ? (
        <NextAppointmentCard appt={nextAppt} navigation={navigation} />
      ) : (
        <EmptyAppointmentCard navigation={navigation} />
      )}

      {/* ── Stats Compact ───────────────────────────── */}
      {stats.total > 0 && (
        <View style={styles.statsStrip}>
          <StatChip
            value={String(stats.active)}
            label="Aktif"
            tone="info"
          />
          <View style={styles.statDivider} />
          <StatChip
            value={String(stats.completed)}
            label="Selesai"
            tone="success"
          />
          <View style={styles.statDivider} />
          <StatChip
            value={String(stats.total)}
            label="Total"
            tone="brand"
          />
        </View>
      )}

      {/* ── Aksi Cepat ──────────────────────────────── */}
      <SectionHeader title="Aksi Cepat" />
      <View style={styles.quickGrid}>
        <QuickActionTile
          icon="add-circle"
          tone="brand"
          title="Buat Janji"
          desc="Reservasi baru"
          onPress={() => navigation.navigate('BookAppointment')}
        />
        <QuickActionTile
          icon="time"
          tone="info"
          title="Riwayat"
          desc="Lihat semua janji"
          onPress={() => navigation.navigate('AppointmentsTab')}
        />
      </View>

      {/* ── Spesialisasi ────────────────────────────── */}
      <SectionHeader
        title="Spesialisasi Klinik"
        action="Lihat semua →"
        onAction={() => navigation.navigate('BookAppointment')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.specialtyScroll}
      >
        {SPECIALTIES.map((s) => (
          <SpecialtyCard
            key={s.key}
            icon={s.icon}
            tone={s.tone}
            name={s.name}
            onPress={() => navigation.navigate('BookAppointment')}
          />
        ))}
      </ScrollView>

      {/* ── Edukasi Kesehatan ──────────────────────── */}
      <SectionHeader title="Edukasi Kesehatan" />
      <View style={{ gap: SPACING.md }}>
        {HEALTH_TIPS.map((tip) => (
          <TipCard
            key={tip.title}
            icon={tip.icon}
            title={tip.title}
            desc={tip.desc}
            tone={tip.tone}
          />
        ))}
      </View>

      {/* ── Kontak Darurat ─────────────────────────── */}
      <SectionHeader title="Kontak Darurat" />
      <EmergencyCard onCall={handleEmergencyCall} />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Admin View
// ═══════════════════════════════════════════════════════════════════
const AdminView = ({
  stats,
  recent,
  navigation,
}: {
  stats: AdminStats;
  recent: Appointment[];
  onRefresh: () => void;
  navigation: any;
}) => (
  <View style={styles.body}>
    {/* ── Hero KPI ─────────────────────────────────── */}
    <View style={styles.adminHero}>
      <View style={styles.adminHeroHead}>
        <Text style={styles.adminHeroEyebrow}>Total Pasien Terdaftar</Text>
        {!!stats.lastSyncAt && (
          <View style={styles.syncPill}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>Sinkron {stats.lastSyncAt}</Text>
          </View>
        )}
      </View>
      <Text style={styles.adminHeroValue}>{stats.patientCount}</Text>
      <Text style={styles.adminHeroSub}>
        {stats.activeReservationCount} reservasi aktif • {stats.pendingCount} menunggu konfirmasi
      </Text>
      <TouchableOpacity
        style={styles.adminHeroBtn}
        onPress={() => navigation.navigate('UsersTab')}
        activeOpacity={0.85}
      >
        <Text style={styles.adminHeroBtnText}>Kelola Pengguna</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
      </TouchableOpacity>
      <Ionicons
        name="people"
        size={130}
        color="rgba(255,255,255,0.10)"
        style={styles.adminHeroDecor}
      />
    </View>

    {/* ── Stats Grid ───────────────────────────────── */}
    <SectionHeader title="Ringkasan Sistem" />
    <View style={styles.statsGrid}>
      <StatTile
        icon="people"
        tone="info"
        value={stats.patientCount}
        label="Total Pasien"
      />
      <StatTile
        icon="medkit"
        tone="success"
        value={stats.activeDoctorCount}
        label="Dokter Aktif"
      />
      <StatTile
        icon="calendar-outline"
        tone="warning"
        value={stats.activeReservationCount}
        label="Reservasi"
      />
      <StatTile
        icon="time"
        tone="brand"
        value={stats.pendingCount}
        label="Menunggu"
      />
    </View>

    {/* ── Aktivitas Terbaru ────────────────────────── */}
    <SectionHeader
      title="Aktivitas Terbaru"
      action={recent.length > 0 ? 'Kelola →' : undefined}
      onAction={() => navigation.navigate('UsersTab')}
    />
    {recent.length === 0 ? (
      <EmptyState
        icon="pulse-outline"
        title="Belum ada aktivitas"
        description="Reservasi baru akan muncul di sini secara real-time."
      />
    ) : (
      <Card variant="outline" padding="none">
        {recent.map((item, idx) => (
          <View key={item.id}>
            <ActivityRow item={item} />
            {idx < recent.length - 1 && <View style={styles.activityDivider} />}
          </View>
        ))}
      </Card>
    )}
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════
const SectionHeader = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {!!action && (
      <TouchableOpacity onPress={onAction} hitSlop={8}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const NextAppointmentCard = ({
  appt,
  navigation,
}: {
  appt: Appointment;
  navigation: any;
}) => {
  const { dateStr, timeStr } = splitAppointmentDate(appt);

  return (
    <View style={styles.nextCard}>
      <View style={styles.nextHead}>
        <Text style={styles.nextEyebrow}>Reservasi Aktif</Text>
        <StatusBadge kind={statusToKind(appt.status)} />
      </View>

      <View style={styles.nextBody}>
        <View style={styles.nextDoctorRow}>
          <View style={styles.nextDoctorAvatar}>
            <Ionicons name="medkit" size={20} color={COLORS.surface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextDoctorName} numberOfLines={1}>
              {appt.doctor_name}
            </Text>
            <Text style={styles.nextPatientName} numberOfLines={1}>
              Untuk {appt.patient_name}
            </Text>
          </View>
        </View>

        <View style={styles.nextMetaRow}>
          <View style={styles.nextMetaPill}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.surface} />
            <Text style={styles.nextMetaText}>{dateStr}</Text>
          </View>
          <View style={styles.nextMetaPill}>
            <Ionicons name="time-outline" size={14} color={COLORS.surface} />
            <Text style={styles.nextMetaText}>{timeStr}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.nextCta}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AppointmentsTab')}
      >
        <Text style={styles.nextCtaText}>Lihat Detail Janji</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
      </TouchableOpacity>

      <Ionicons
        name="medical"
        size={140}
        color="rgba(255,255,255,0.08)"
        style={styles.nextDecor}
      />
    </View>
  );
};

const EmptyAppointmentCard = ({ navigation }: { navigation: any }) => (
  <Card variant="default" padding="lg">
    <View style={styles.emptyApptInner}>
      <IconBadge icon="calendar-outline" tone="brand" size="lg" />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={styles.emptyApptTitle}>Belum Ada Janji Aktif</Text>
        <Text style={styles.emptyApptDesc}>
          Buat janji pertama Anda dengan dokter spesialis dalam hitungan menit.
        </Text>
      </View>
      <Button
        label="Buat Janji Sekarang"
        onPress={() => navigation.navigate('BookAppointment')}
        size="md"
        icon="arrow-forward"
        iconPosition="right"
        style={{ marginTop: SPACING.sm }}
      />
    </View>
  </Card>
);

const StatChip = ({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: 'brand' | 'info' | 'success';
}) => {
  const color =
    tone === 'brand'
      ? COLORS.primary
      : tone === 'info'
        ? COLORS.info
        : COLORS.success;

  return (
    <View style={styles.statChip}>
      <Text style={[styles.statChipValue, { color }]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
};

const QuickActionTile = ({
  icon,
  tone,
  title,
  desc,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning';
  title: string;
  desc: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={styles.quickWrap}
    accessibilityRole="button"
    accessibilityLabel={title}
  >
    <Card variant="default" padding="md">
      <View style={{ gap: SPACING.md }}>
        <IconBadge icon={icon} tone={tone} size="md" />
        <View style={{ gap: 2 }}>
          <Text style={styles.quickTitle}>{title}</Text>
          <Text style={styles.quickDesc}>{desc}</Text>
        </View>
      </View>
    </Card>
  </TouchableOpacity>
);

const SpecialtyCard = ({
  icon,
  tone,
  name,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'doctor';
  name: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Spesialisasi ${name}`}
    style={styles.specialtyCard}
  >
    <IconBadge icon={icon} tone={tone} size="lg" shape="circle" />
    <Text style={styles.specialtyName}>{name}</Text>
  </TouchableOpacity>
);

const TipCard = ({
  icon,
  title,
  desc,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  tone: 'success' | 'info' | 'warning';
}) => (
  <Card variant="outline" padding="md">
    <View style={styles.tipRow}>
      <IconBadge icon={icon} tone={tone} size="md" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipDesc}>{desc}</Text>
      </View>
    </View>
  </Card>
);

const EmergencyCard = ({ onCall }: { onCall: () => void }) => (
  <View style={styles.emergencyCard}>
    <View style={styles.emergencyHead}>
      <View style={styles.emergencyIcon}>
        <Ionicons name="chatbubbles" size={22} color={COLORS.surface} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.emergencyTitle}>Bantuan Medis 24/7</Text>
        <Text style={styles.emergencyDesc}>
          Klik tombol di bawah untuk kirim pesan WhatsApp darurat langsung.
        </Text>
      </View>
    </View>
    <TouchableOpacity
      style={styles.emergencyBtn}
      activeOpacity={0.85}
      onPress={onCall}
      accessibilityRole="button"
      accessibilityLabel={`WhatsApp Darurat ${EMERGENCY_LABEL}`}
    >
      <Ionicons name="logo-whatsapp" size={16} color={COLORS.danger} />
      <Text style={styles.emergencyBtnText}>{EMERGENCY_LABEL}</Text>
    </TouchableOpacity>
  </View>
);

const StatTile = ({
  icon,
  tone,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'info' | 'success' | 'warning' | 'brand';
  value: number;
  label: string;
}) => (
  <View style={styles.statTileWrap}>
    <Card variant="default" padding="md">
      <View style={{ gap: SPACING.sm }}>
        <IconBadge icon={icon} tone={tone} size="md" />
        <View style={{ gap: 2 }}>
          <Text style={styles.statTileValue}>{value}</Text>
          <Text style={styles.statTileLabel}>{label}</Text>
        </View>
      </View>
    </Card>
  </View>
);

const ActivityRow = ({ item }: { item: Appointment }) => {
  const initials = (item.patient_name || '?').charAt(0).toUpperCase();
  const { dateStr } = splitAppointmentDate(item);
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityAvatar}>
        <Text style={styles.activityInitials}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityName} numberOfLines={1}>
          {item.patient_name || 'Anonim'}
        </Text>
        <Text style={styles.activityMeta} numberOfLines={1}>
          {item.doctor_name} • {dateStr}
        </Text>
      </View>
      <StatusBadge kind={statusToKind(item.status)} showIcon={false} showDot />
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: LAYOUT.bottomSafeGap + SPACING.md },

  // ── Header ───────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  headerLeft: { flex: 1, gap: 4 },
  headerDate: { ...TYPO.overline, color: COLORS.primary },
  headerGreeting: { ...TYPO.h1, color: COLORS.textPrimary, marginTop: 2 },
  headerSub: { ...TYPO.body, color: COLORS.textMuted },
  avatarWrap: {},
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // ── Section ──────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary },
  sectionAction: { ...TYPO.label, color: COLORS.primary },

  // ── Next Appointment Card ───────────────────────
  nextCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    overflow: 'hidden',
    position: 'relative',
    gap: SPACING.lg,
    ...SHADOWS.brand,
  },
  nextHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  nextEyebrow: { ...TYPO.overline, color: 'rgba(255,255,255,0.85)' },
  nextBody: { gap: SPACING.md, zIndex: 2 },
  nextDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  nextDoctorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextDoctorName: { ...TYPO.h2, color: COLORS.textOnPrimary, fontSize: 20 },
  nextPatientName: {
    ...TYPO.bodySm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  nextMetaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  nextMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  nextMetaText: { ...TYPO.labelSm, color: COLORS.textOnPrimary },
  nextCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    zIndex: 2,
  },
  nextCtaText: { ...TYPO.label, color: COLORS.primary },
  nextDecor: {
    position: 'absolute',
    right: -30,
    bottom: -20,
    zIndex: 1,
  },

  // ── Empty Appointment ───────────────────────────
  emptyApptInner: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  emptyApptTitle: { ...TYPO.h3, color: COLORS.textPrimary, textAlign: 'center' },
  emptyApptDesc: {
    ...TYPO.bodySm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },

  // ── Stats Strip ─────────────────────────────────
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  statChip: { flex: 1, alignItems: 'center', gap: 2 },
  statChipValue: { ...TYPO.h2 },
  statChipLabel: { ...TYPO.caption, color: COLORS.textMuted },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.xs,
  },

  // ── Quick Action ────────────────────────────────
  quickGrid: { flexDirection: 'row', gap: SPACING.md },
  quickWrap: { flex: 1 },
  quickTitle: { ...TYPO.label, color: COLORS.textPrimary },
  quickDesc: { ...TYPO.caption, color: COLORS.textMuted },

  // ── Specialty ───────────────────────────────────
  specialtyScroll: { gap: SPACING.md, paddingRight: SPACING.lg },
  specialtyCard: {
    width: 88,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  specialtyName: { ...TYPO.labelSm, color: COLORS.textPrimary, textAlign: 'center' },

  // ── Tip ─────────────────────────────────────────
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  tipTitle: { ...TYPO.label, color: COLORS.textPrimary },
  tipDesc: { ...TYPO.bodySm, color: COLORS.textMuted, lineHeight: 20 },

  // ── Emergency ───────────────────────────────────
  emergencyCard: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: SPACING.md,
  },
  emergencyHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyTitle: { ...TYPO.label, color: COLORS.dangerText, fontSize: 15 },
  emergencyDesc: { ...TYPO.bodySm, color: COLORS.dangerText, opacity: 0.85, lineHeight: 18 },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.dangerBg,
  },
  emergencyBtnText: { ...TYPO.label, color: COLORS.danger, fontSize: 15 },

  // ── Admin Hero ──────────────────────────────────
  adminHero: {
    backgroundColor: COLORS.brand800,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    overflow: 'hidden',
    position: 'relative',
    gap: SPACING.sm,
    ...SHADOWS.brand,
  },
  adminHeroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  adminHeroEyebrow: {
    ...TYPO.overline,
    color: 'rgba(255,255,255,0.85)',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: RADIUS.pill,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand200,
  },
  syncText: { ...TYPO.caption, color: COLORS.surface, fontWeight: '700' },
  adminHeroValue: {
    ...TYPO.display,
    color: COLORS.textOnPrimary,
    fontSize: 44,
    lineHeight: 50,
    zIndex: 2,
  },
  adminHeroSub: {
    ...TYPO.bodySm,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: SPACING.md,
    zIndex: 2,
  },
  adminHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
    zIndex: 2,
  },
  adminHeroBtnText: { ...TYPO.label, color: COLORS.primary },
  adminHeroDecor: {
    position: 'absolute',
    right: -30,
    bottom: -25,
    zIndex: 1,
  },

  // ── Stats Grid (Admin) ───────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statTileWrap: { width: '47.5%' },
  statTileValue: { ...TYPO.h2, color: COLORS.textPrimary },
  statTileLabel: { ...TYPO.caption, color: COLORS.textMuted },

  // ── Activity ─────────────────────────────────────
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  activityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInitials: { ...TYPO.label, color: COLORS.primary, fontWeight: '800' },
  activityName: { ...TYPO.label, color: COLORS.textPrimary, fontSize: 14 },
  activityMeta: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },
  activityDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },

  // ── Floating Action Button ───────────────────────
  fabChatbot: {
    position: 'absolute',
    bottom: LAYOUT.bottomTabHeight + SPACING.md, // 84 + 12 = 96, supaya tidak tertutup tab bar
    right: SPACING.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surface, // Background putih di balik image
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 999,
  },
});
