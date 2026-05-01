/**
 * DoctorDashboardScreen — Beranda Portal Dokter.
 * Statistik antrean, request pending, dan pasien berikutnya.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
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
  consultation_fee?: number | null;
};

// ── Konstanta & helper untuk preview pendapatan ──
// Tarif default sama dengan DoctorEarningsScreen agar angka konsisten
// di kedua tempat. Jika nanti ada kolom price/fee di DB, ganti ke
// kolom tersebut di kedua file.
const CONSULTATION_FEE = 150_000;

const formatIDR = (n: number): string =>
  'Rp ' + Math.round(n).toLocaleString('id-ID');

const formatIDRShort = (n: number): string => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (n >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${n}`;
};

const feeFor = (a: Appointment): number =>
  typeof a.consultation_fee === 'number' && a.consultation_fee > 0
    ? a.consultation_fee
    : CONSULTATION_FEE;

const dateOfAppt = (a: Appointment): Date => {
  if (a.appointment_date) {
    const d = new Date(a.appointment_date);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(a.created_at);
};

export default function DoctorDashboardScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;

      setEmail(user.email || '');

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
        .select(
          'id, patient_name, doctor_id, doctor_name, date, symptoms, status, created_at, appointment_date, consultation_fee'
        )
        .eq('doctor_id', doctorData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments((data as Appointment[]) || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat dashboard dokter.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pending = appointments.filter((a) => a.status === 'pending');
  const confirmed = appointments.filter((a) => a.status === 'Confirmed');
  const selesai = appointments.filter((a) => a.status === 'Selesai');
  const nextPatient = confirmed[0] ?? pending[0] ?? null;
  const doctorName = email.split('@')[0] || 'Dokter';

  // ── Preview pendapatan bulan berjalan ──
  // Bukan sumber kebenaran tunggal — layar `DoctorEarnings` punya
  // analitik penuh. Ini hanya teaser di dashboard.
  const now = new Date();
  const thisMonthSelesai = selesai.filter((a) => {
    const d = dateOfAppt(a);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  });
  const revenueThisMonth = thisMonthSelesai.reduce((sum, appt) => sum + feeFor(appt), 0);
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const handleAction = async (
    id: string,
    action: 'Confirmed' | 'Cancelled',
    patientName: string
  ) => {
    const label = action === 'Confirmed' ? 'Konfirmasi' : 'Tolak';
    Alert.alert(
      `${label} Permintaan`,
      `${label} jadwal dari ${patientName}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: label,
          style: action === 'Cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .update({ status: action })
              .eq('id', id);
            if (error) Alert.alert('Error', error.message);
            else loadData();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat dashboard…" />
      </SafeAreaView>
    );
  }

  return (
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.greetWrap}>
            <Text style={styles.eyebrow}>Portal Dokter</Text>
            <Text style={styles.greeting}>Halo, Dr. {doctorName}</Text>
            <Text style={styles.subtitle}>
              Selamat bertugas hari ini. Berikut ringkasan antrean Anda.
            </Text>
          </View>
          <IconBadge icon="medkit" tone="doctor" size="lg" />
        </View>

        {!!errorMessage && (
          <ErrorState
            message={errorMessage}
            onRetry={loadData}
            style={{ marginBottom: SPACING.md }}
          />
        )}

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>Status Antrean</Text>
            <Text style={styles.heroTitle}>
              {pending.length > 0
                ? `${pending.length} permintaan menunggu konfirmasi`
                : 'Semua permintaan sudah ditangani'}
            </Text>
            <Text style={styles.heroDesc}>
              {pending.length > 0
                ? 'Konfirmasi atau tolak permintaan untuk membantu pasien.'
                : 'Selamat bekerja — antrean Anda terkendali.'}
            </Text>
            <TouchableOpacity
              style={styles.heroBtn}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('DoctorAppointments')}
            >
              <Text style={styles.heroBtnText}>Lihat Antrean</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Ionicons
            name="pulse"
            size={120}
            color="rgba(255,255,255,0.12)"
            style={styles.heroDecor}
          />
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Rangkuman Hari Ini</Text>
        <View style={styles.statsRow}>
          <StatTile icon="time"             tone="warning" value={pending.length}   label="Menunggu" />
          <StatTile icon="checkmark-circle" tone="info"    value={confirmed.length} label="Dikonfirmasi" />
          <StatTile icon="checkmark-done"   tone="success" value={selesai.length}   label="Selesai" />
        </View>

        {/* ── Earnings Preview — nav ke DoctorEarningsScreen ── */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('DoctorAnalytics')}
          style={styles.earningsCard}
          accessibilityRole="button"
          accessibilityLabel="Lihat analitik pendapatan lengkap"
        >
          <View style={styles.earningsHead}>
            <View style={styles.earningsIconWrap}>
              <Ionicons name="trending-up" size={20} color={COLORS.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsEyebrow}>Pendapatan {monthLabel}</Text>
              <Text style={styles.earningsAmount}>{formatIDR(revenueThisMonth)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </View>

          <View style={styles.earningsFooter}>
            <View style={styles.earningsMetric}>
              <Ionicons name="checkmark-done" size={14} color={COLORS.success} />
              <Text style={styles.earningsMetricText}>
                {thisMonthSelesai.length} konsultasi selesai
              </Text>
            </View>
            <View style={styles.earningsLink}>
              <Text style={styles.earningsLinkText}>Lihat analitik</Text>
              <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Request Pasien Baru</Text>
              <StatusBadge kind="pending" label={`${pending.length} baru`} />
            </View>
            {pending.slice(0, 3).map((item) => (
              <Card key={item.id} variant="accent" accentColor={COLORS.warning} padding="md" style={{ marginBottom: SPACING.md }}>
                <View style={styles.requestHead}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientInitials}>
                      {item.patient_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>{item.patient_name}</Text>
                    <Text style={styles.patientDate} numberOfLines={1}>
                      {item.date}
                    </Text>
                  </View>
                  <StatusBadge kind="warning" label="Baru" showIcon={false} />
                </View>

                <View style={styles.complaintBox}>
                  <Text style={styles.complaintLabel}>Keluhan</Text>
                  <Text style={styles.complaintText} numberOfLines={3}>
                    {item.symptoms}
                  </Text>
                </View>

                <View style={styles.actionRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Tolak"
                      onPress={() => handleAction(item.id, 'Cancelled', item.patient_name)}
                      variant="outline"
                      icon="close"
                      iconPosition="left"
                      size="md"
                      fullWidth
                      textStyle={{ color: COLORS.danger }}
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Button
                      label="Konfirmasi"
                      onPress={() => handleAction(item.id, 'Confirmed', item.patient_name)}
                      variant="success"
                      icon="checkmark"
                      iconPosition="left"
                      size="md"
                      fullWidth
                    />
                  </View>
                </View>
              </Card>
            ))}
            {pending.length > 3 && (
              <TouchableOpacity
                style={styles.seeMoreBtn}
                onPress={() => navigation.navigate('DoctorAppointments')}
              >
                <Text style={styles.seeMoreText}>
                  Lihat {pending.length - 3} request lainnya →
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Next Patient */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Pasien Berikutnya</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DoctorAppointments')}>
            <Text style={styles.linkText}>Lihat semua</Text>
          </TouchableOpacity>
        </View>

        {nextPatient ? (
          <Card variant="default" padding="lg">
            <View style={styles.nextHead}>
              <StatusBadge
                kind={nextPatient.status === 'Confirmed' ? 'confirmed' : 'pending'}
              />
              <Text style={styles.nextTime} numberOfLines={1}>
                {nextPatient.date.split(' | ')[1] || nextPatient.date}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.nextBody}>
              <View style={styles.patientAvatarLg}>
                <Text style={styles.patientInitialsLg}>
                  {nextPatient.patient_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName}>{nextPatient.patient_name}</Text>
                <Text style={styles.patientDesc} numberOfLines={2}>
                  {nextPatient.symptoms}
                </Text>
              </View>
            </View>
            {nextPatient.status === 'Confirmed' && (
              <Button
                label="Panggil Pasien"
                onPress={() => navigation.navigate('DoctorAppointments')}
                icon="megaphone"
                iconPosition="left"
                size="md"
                fullWidth
                style={{ marginTop: SPACING.md }}
              />
            )}
          </Card>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="Belum ada jadwal"
            description="Tidak ada pasien dalam antrean Anda saat ini."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────
const StatTile = ({
  icon,
  tone,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'warning' | 'info' | 'success';
  value: number;
  label: string;
}) => (
  <View style={styles.statWrap}>
    <Card variant="default" padding="md">
      <View style={{ alignItems: 'flex-start', gap: SPACING.sm }}>
        <IconBadge icon={icon} tone={tone} size="md" />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </Card>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
    gap: SPACING.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  greetWrap: { flex: 1, gap: 2 },
  eyebrow: { ...TYPO.overline, color: COLORS.primary },
  greeting: { ...TYPO.h1, color: COLORS.textPrimary, marginTop: 2 },
  subtitle: { ...TYPO.body, color: COLORS.textMuted, marginTop: 4 },

  // Hero
  hero: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.brand,
  },
  heroText: { gap: 6, paddingRight: SPACING.huge, zIndex: 2 },
  heroEyebrow: { ...TYPO.overline, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { ...TYPO.h2, color: COLORS.textOnPrimary },
  heroDesc: { ...TYPO.bodySm, color: 'rgba(255,255,255,0.92)', marginBottom: SPACING.md },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
    gap: SPACING.sm,
  },
  heroBtnText: { ...TYPO.label, color: COLORS.primary },
  heroDecor: { position: 'absolute', right: -20, bottom: -20, zIndex: 1 },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary },
  linkText: { ...TYPO.label, color: COLORS.primary },

  // Stats
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statWrap: { flex: 1 },
  statValue: { ...TYPO.h2, color: COLORS.textPrimary },
  statLabel: { ...TYPO.caption, color: COLORS.textMuted },

  // Request card
  requestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInitials: { ...TYPO.h4, color: COLORS.primary },
  patientName: { ...TYPO.label, color: COLORS.textPrimary, fontSize: 15 },
  patientDate: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },

  complaintBox: {
    backgroundColor: COLORS.backgroundAlt,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: 4,
  },
  complaintLabel: { ...TYPO.overline, color: COLORS.textMuted },
  complaintText: { ...TYPO.bodySm, color: COLORS.textSecondary, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: SPACING.md },

  seeMoreBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  seeMoreText: { ...TYPO.label, color: COLORS.primary },

  // Next Patient
  nextHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nextTime: { ...TYPO.label, color: COLORS.primary, maxWidth: 140 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  nextBody: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  patientAvatarLg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInitialsLg: { ...TYPO.h2, color: COLORS.primary },
  patientDesc: { ...TYPO.bodySm, color: COLORS.textMuted, marginTop: 2, lineHeight: 20 },

  // Earnings preview card
  earningsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
    gap: SPACING.md,
  },
  earningsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  earningsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsEyebrow: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    textTransform: 'capitalize',
  },
  earningsAmount: {
    ...TYPO.h2,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  earningsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  earningsMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsMetricText: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  earningsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earningsLinkText: {
    ...TYPO.labelSm,
    color: COLORS.primary,
    fontWeight: '700',
  },
});
