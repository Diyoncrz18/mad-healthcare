/**
 * DoctorDashboardScreen — Beranda Portal Dokter
 * Menampilkan statistik hari ini, request pasien pending (perlu konfirmasi),
 * dan pasien berikutnya dalam antrean.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';

type Appointment = {
  id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  symptoms: string;
  status: string;
  created_at: string;
};

export default function DoctorDashboardScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  /* ─── Load Data ───────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (user) {
        setEmail(user.email || '');

        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('id, name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (doctorError) throw doctorError;

        if (!doctorData?.id) {
          setAppointments([]);
          setErrorMessage('Akun dokter ini belum terhubung ke profil dokter. Hubungi admin untuk sinkronisasi data.');
          return;
        }

        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('doctor_id', doctorData.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAppointments((data as Appointment[]) || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat dashboard dokter.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload setiap kali tab ini difokuskan
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  /* ─── Derived Stats ───────────────────────────────────────── */
  const pending     = appointments.filter(a => a.status === 'pending');
  const confirmed   = appointments.filter(a => a.status === 'Confirmed');
  const selesai     = appointments.filter(a => a.status === 'Selesai');
  const nextPatient = confirmed[0] ?? pending[0] ?? null;
  const doctorName  = email.split('@')[0] || 'Dokter';

  /* ─── Approve / Reject Handler ────────────────────────────── */
  const handleAction = async (id: string, action: 'Confirmed' | 'Cancelled', patientName: string) => {
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.doctorPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.doctorPrimary} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Halo, Dr. {doctorName} 👋</Text>
            <Text style={styles.subtitle}>Selamat bekerja dan melayani pasien Anda.</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="medkit" size={26} color={COLORS.doctorPrimary} />
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={loadData}>
              <Text style={styles.errorBtnText}>Coba Lagi</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Banner Operasional ── */}
        <View style={[styles.bannerCard, { backgroundColor: COLORS.doctorPrimary }]}>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Portal Dokter Aktif</Text>
            <Text style={styles.bannerDesc}>
              {pending.length > 0
                ? `Ada ${pending.length} permintaan baru menunggu konfirmasi Anda.`
                : 'Semua permintaan sudah ditangani. Selamat bekerja!'}
            </Text>
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => navigation.navigate('DoctorAppointments')}
            >
              <Text style={[styles.bannerBtnText, { color: COLORS.doctorPrimary }]}>
                Lihat Antrean
              </Text>
            </TouchableOpacity>
          </View>
          <Ionicons name="pulse" size={88} color="rgba(255,255,255,0.15)" style={styles.bannerIcon} />
        </View>

        {/* ── Quick Stats ── */}
        <Text style={styles.sectionTitle}>Rangkuman Hari Ini</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.warningBg }]}>
              <Ionicons name="time" size={22} color={COLORS.warning} />
            </View>
            <Text style={styles.statValue}>{pending.length}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.infoBg }]}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.info} />
            </View>
            <Text style={styles.statValue}>{confirmed.length}</Text>
            <Text style={styles.statLabel}>Dikonfirmasi</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.iconBox, { backgroundColor: COLORS.successBg }]}>
              <Ionicons name="checkmark-done" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.statValue}>{selesai.length}</Text>
            <Text style={styles.statLabel}>Selesai</Text>
          </View>
        </View>

        {/* ── Request Baru dari Pasien ── */}
        {pending.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Request Pasien Baru</Text>
              <View style={styles.badgePending}>
                <Text style={styles.badgePendingText}>{pending.length}</Text>
              </View>
            </View>
            {pending.slice(0, 3).map((item) => (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.requestCardHeader}>
                  <View style={styles.patientAvatarSmall}>
                    <Text style={styles.patientInitialsSmall}>
                      {item.patient_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestPatientName}>{item.patient_name}</Text>
                    <Text style={styles.requestDate} numberOfLines={1}>{item.date}</Text>
                  </View>
                  <View style={styles.pendingTag}>
                    <Text style={styles.pendingTagText}>Baru</Text>
                  </View>
                </View>
                <View style={styles.complaintBox}>
                  <Text style={styles.complaintLabel}>Keluhan:</Text>
                  <Text style={styles.complaintText} numberOfLines={2}>{item.symptoms}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => handleAction(item.id, 'Cancelled', item.patient_name)}
                  >
                    <Ionicons name="close" size={16} color={COLORS.danger} />
                    <Text style={styles.rejectBtnText}>Tolak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAction(item.id, 'Confirmed', item.patient_name)}
                  >
                    <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} />
                    <Text style={styles.acceptBtnText}>Konfirmasi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {pending.length > 3 && (
              <TouchableOpacity
                style={styles.seeMoreBtn}
                onPress={() => navigation.navigate('DoctorAppointments')}
              >
                <Text style={styles.seeMoreText}>Lihat {pending.length - 3} request lainnya →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── Pasien Berikutnya ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pasien Berikutnya</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DoctorAppointments')}>
            <Text style={styles.seeAllText}>Lihat Semua</Text>
          </TouchableOpacity>
        </View>

        {nextPatient ? (
          <View style={styles.nextPatientCard}>
            <View style={styles.patientHeader}>
              <View style={styles.statusBadge}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: nextPatient.status === 'Confirmed' ? COLORS.success : COLORS.warning }
                ]} />
                <Text style={styles.statusText}>
                  {nextPatient.status === 'Confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                </Text>
              </View>
              <Text style={styles.timeText} numberOfLines={1}>{nextPatient.date.split(' | ')[1] || nextPatient.date}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.patientInfo}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientInitials}>
                  {nextPatient.patient_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.patientDetails}>
                <Text style={styles.patientName}>{nextPatient.patient_name}</Text>
                <Text style={styles.patientDesc} numberOfLines={2}>{nextPatient.symptoms}</Text>
              </View>
            </View>
            {nextPatient.status === 'Confirmed' && (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => navigation.navigate('DoctorAppointments')}
              >
                <Ionicons name="megaphone" size={18} color={COLORS.textOnPrimary} style={{ marginRight: 6 }} />
                <Text style={styles.callBtnText}>Panggil Pasien</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.border} />
            <Text style={styles.emptyText}>Belum ada jadwal hari ini.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, padding: SPACING.xl, paddingBottom: 120 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.xl, paddingTop: 10,
  },
  userInfo: { flex: 1, paddingRight: SPACING.xl },
  greeting: { fontSize: 22, ...FONTS.heading, color: COLORS.textPrimary },
  subtitle: { fontSize: 13, ...FONTS.body, color: COLORS.textMuted, marginTop: 4, lineHeight: 20 },
  avatarContainer: {
    width: 52, height: 52, borderRadius: RADIUS.xl,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.doctorPrimaryLight,
    borderWidth: 1.5, borderColor: COLORS.doctorPrimary,
  },

  errorCard: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { ...FONTS.body, fontSize: 13, color: COLORS.danger, lineHeight: 20, marginBottom: SPACING.sm },
  errorBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.pill },
  errorBtnText: { ...FONTS.label, fontSize: 12, color: COLORS.danger },
  bannerCard: {
    borderRadius: RADIUS.xxl, padding: SPACING.xl, overflow: 'hidden',
    position: 'relative', marginBottom: SPACING.lg, ...SHADOWS.md,
  },
  bannerTextContainer: { zIndex: 2, paddingRight: 40 },
  bannerTitle: { fontSize: 20, ...FONTS.heading, color: COLORS.textOnPrimary, marginBottom: SPACING.xs },
  bannerDesc: { fontSize: 13, ...FONTS.body, color: 'rgba(255,255,255,0.9)', lineHeight: 20, marginBottom: SPACING.lg },
  bannerBtn: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill, alignSelf: 'flex-start',
  },
  bannerBtnText: { ...FONTS.label, fontSize: 13 },
  bannerIcon: { position: 'absolute', right: -15, bottom: -15, zIndex: 1 },

  sectionTitle: { fontSize: 17, ...FONTS.subheading, color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },
  seeAllText: { fontSize: 13, ...FONTS.label, color: COLORS.doctorPrimary },

  statsContainer: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center',
  },
  iconBox: { width: 42, height: 42, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: 22, ...FONTS.heading, color: COLORS.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 11, ...FONTS.caption, color: COLORS.textMuted, textAlign: 'center' },

  badgePending: {
    backgroundColor: COLORS.warningBg, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  badgePendingText: { ...FONTS.label, fontSize: 13, color: COLORS.warning },

  requestCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    ...SHADOWS.sm, borderWidth: 1, borderLeftWidth: 4, borderColor: COLORS.borderLight,
    borderLeftColor: COLORS.warning, marginBottom: SPACING.md,
  },
  requestCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  patientAvatarSmall: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.doctorPrimaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  patientInitialsSmall: { ...FONTS.heading, color: COLORS.doctorPrimary, fontSize: 16 },
  requestPatientName: { ...FONTS.subheading, fontSize: 15, color: COLORS.textPrimary },
  requestDate: { ...FONTS.caption, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pendingTag: { backgroundColor: COLORS.warningBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  pendingTagText: { ...FONTS.label, fontSize: 11, color: COLORS.warning },

  complaintBox: { backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  complaintLabel: { ...FONTS.label, fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  complaintText: { ...FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  requestActions: { flexDirection: 'row', gap: SPACING.md },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: RADIUS.lg, gap: 4,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  rejectBtnText: { ...FONTS.label, fontSize: 14, color: COLORS.danger },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: RADIUS.lg, gap: 4,
    backgroundColor: COLORS.doctorPrimary,
  },
  acceptBtnText: { ...FONTS.label, fontSize: 14, color: COLORS.textOnPrimary },

  seeMoreBtn: {
    alignItems: 'center', paddingVertical: SPACING.md, marginBottom: SPACING.md,
  },
  seeMoreText: { ...FONTS.label, fontSize: 13, color: COLORS.doctorPrimary },

  nextPatientCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl,
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.doctorPrimaryLight,
  },
  patientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...FONTS.label, fontSize: 13, color: COLORS.textSecondary },
  timeText: { ...FONTS.label, color: COLORS.doctorPrimary, fontSize: 13, maxWidth: 120 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  patientInfo: { flexDirection: 'row', marginBottom: SPACING.lg, alignItems: 'center' },
  patientAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.doctorPrimaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  patientInitials: { ...FONTS.heading, color: COLORS.doctorPrimary, fontSize: 20 },
  patientDetails: { flex: 1 },
  patientName: { ...FONTS.subheading, color: COLORS.textPrimary, fontSize: 16, marginBottom: 2 },
  patientDesc: { ...FONTS.body, color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  callBtn: {
    backgroundColor: COLORS.doctorPrimary, flexDirection: 'row', borderRadius: RADIUS.lg,
    paddingVertical: 12, justifyContent: 'center', alignItems: 'center',
  },
  callBtnText: { ...FONTS.label, color: COLORS.textOnPrimary, fontSize: 15 },

  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xxxl,
    alignItems: 'center', ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  emptyText: { ...FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.md },
});
