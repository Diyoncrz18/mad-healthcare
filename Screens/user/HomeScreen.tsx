import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { UserRole } from '../types';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';

export default function HomeScreen({ navigation }: any) {
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRefreshing, setAdminRefreshing] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminStats, setAdminStats] = useState({
    patientCount: 0,
    activeDoctorCount: 0,
    activeReservationCount: 0,
    pendingCount: 0,
    lastSyncAt: '',
  });

  const loadAdminStats = useCallback(async () => {
    try {
      setAdminError('');
      setAdminLoading(true);

      const [{ data: appointments, error: appointmentsError }, { data: doctors, error: doctorsError }] = await Promise.all([
        supabase.from('appointments').select('user_id, status'),
        supabase.from('doctors').select('id, is_active'),
      ]);

      if (appointmentsError) throw appointmentsError;
      if (doctorsError) throw doctorsError;

      const uniquePatients = new Set((appointments || []).map((item: any) => item.user_id).filter(Boolean));
      const activeReservationCount = (appointments || []).filter((item: any) => item.status === 'pending' || item.status === 'Confirmed').length;
      const pendingCount = (appointments || []).filter((item: any) => item.status === 'pending').length;
      const activeDoctorCount = (doctors || []).filter((item: any) => item.is_active).length;

      setAdminStats({
        patientCount: uniquePatients.size,
        activeDoctorCount,
        activeReservationCount,
        pendingCount,
        lastSyncAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err: any) {
      setAdminError(err.message || 'Gagal memuat ringkasan sistem.');
    } finally {
      setAdminLoading(false);
      setAdminRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        const nextRole = (user.user_metadata?.role || 'user') as UserRole;
        setEmail(user.email || '');
        setRole(nextRole);
        if (nextRole === 'admin') {
          loadAdminStats();
        }
      }
    };
    fetchUser();
  }, [loadAdminStats]);

  useFocusEffect(useCallback(() => {
    if (role === 'admin') {
      loadAdminStats();
    }
  }, [role, loadAdminStats]));

  const onRefresh = () => {
    if (role !== 'admin') return;
    setAdminRefreshing(true);
    loadAdminStats();
  };

  const isUser = role === 'user';
  const themeColor = isUser ? COLORS.userPrimary : COLORS.adminPrimary;
  const themeLightColor = isUser ? COLORS.userPrimaryLight : COLORS.adminPrimaryLight;
  const userName = email.split('@')[0] || 'Pengguna';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={adminRefreshing} onRefresh={onRefresh} tintColor={themeColor} />}
      >

        {/* Premium Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>Halo, {userName} 👋</Text>
            <Text style={styles.subtitle}>
              {isUser ? 'Bagaimana kesehatan Anda hari ini?' : 'Ringkasan operasional klinik hari ini.'}
            </Text>
          </View>
          <View style={[styles.avatarContainer, { backgroundColor: themeLightColor, borderColor: themeColor }]}>
            <Ionicons name={isUser ? 'person' : 'shield-checkmark'} size={26} color={themeColor} />
          </View>
        </View>

        {/* User Content */}
        {isUser ? (
          <View style={styles.content}>
            {/* Health Info / Banner */}
            <View style={[styles.bannerCard, { backgroundColor: themeColor }]}>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Konsultasi Cepat</Text>
                <Text style={styles.bannerDesc}>Jadwalkan pertemuan dengan dokter spesialis kami dengan mudah dan cepat.</Text>
                <TouchableOpacity 
                  style={styles.bannerBtn} 
                  onPress={() => navigation.navigate('BookAppointment')}
                >
                  <Text style={[styles.bannerBtnText, { color: themeColor }]}>Buat Janji Sekarang</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="medical" size={80} color="rgba(255,255,255,0.15)" style={styles.bannerIcon} />
            </View>

            <Text style={styles.sectionTitle}>Akses Cepat</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('BookAppointment')}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrapper, { backgroundColor: themeLightColor }]}>
                  <Ionicons name="calendar" size={24} color={themeColor} />
                </View>
                <Text style={styles.actionTitle}>Reservasi Baru</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('AppointmentsTab')}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrapper, { backgroundColor: COLORS.infoBg }]}>
                  <Ionicons name="receipt-outline" size={24} color={COLORS.info} />
                </View>
                <Text style={styles.actionTitle}>Riwayat Medis</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Info Kesehatan Terbaru</Text>
            <View style={styles.infoCard}>
              <View style={[styles.iconWrapperSmall, { backgroundColor: COLORS.successBg }]}>
                <Ionicons name="leaf-outline" size={18} color={COLORS.success} />
              </View>
              <View style={styles.infoTextWrapper}>
                <Text style={styles.infoTitle}>Pola Makan Sehat</Text>
                <Text style={styles.infoDesc}>Jaga asupan nutrisi untuk meningkatkan imun di musim hujan.</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Admin Content */
          <View style={styles.content}>
            {/* Admin Banner */}
            <View style={[styles.bannerCard, { backgroundColor: COLORS.adminPrimary }]}>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.bannerTitle}>Pusat Kendali</Text>
                <Text style={styles.bannerDesc}>Pantau statistik klinik dan kelola data pengguna secara real-time.</Text>
                <TouchableOpacity 
                  style={styles.bannerBtn} 
                  onPress={() => navigation.navigate('UsersTab')}
                >
                  <Text style={[styles.bannerBtnText, { color: COLORS.adminPrimary }]}>Kelola Pengguna</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="analytics" size={80} color="rgba(255,255,255,0.15)" style={styles.bannerIcon} />
            </View>

            <Text style={styles.sectionTitle}>Ringkasan Sistem</Text>
            {adminError ? (
              <View style={styles.adminErrorCard}>
                <Text style={styles.adminErrorText}>{adminError}</Text>
                <TouchableOpacity style={styles.adminRetryBtn} onPress={loadAdminStats}>
                  <Text style={styles.adminRetryText}>Coba Lagi</Text>
                </TouchableOpacity>
              </View>
            ) : adminLoading ? (
              <View style={styles.adminLoadingCard}>
                <ActivityIndicator size="small" color={COLORS.adminPrimary} />
                <Text style={styles.adminLoadingText}>Memuat statistik klinik...</Text>
              </View>
            ) : (
              <View style={styles.adminStatsGrid}>
              <View style={styles.adminStatCard}>
                <View style={[styles.adminStatIcon, { backgroundColor: COLORS.infoBg }]}>
                  <Ionicons name="people" size={22} color={COLORS.info} />
                </View>
                <View style={styles.adminStatText}>
                  <Text style={styles.adminStatValue}>{adminStats.patientCount}</Text>
                  <Text style={styles.adminStatLabel}>Total Pasien</Text>
                </View>
              </View>
              <View style={styles.adminStatCard}>
                <View style={[styles.adminStatIcon, { backgroundColor: COLORS.successBg }]}>
                  <Ionicons name="medkit" size={22} color={COLORS.success} />
                </View>
                <View style={styles.adminStatText}>
                  <Text style={styles.adminStatValue}>{adminStats.activeDoctorCount}</Text>
                  <Text style={styles.adminStatLabel}>Dokter Aktif</Text>
                </View>
              </View>
              <View style={styles.adminStatCard}>
                <View style={[styles.adminStatIcon, { backgroundColor: COLORS.warningBg }]}>
                  <Ionicons name="calendar-outline" size={22} color={COLORS.warning} />
                </View>
                <View style={styles.adminStatText}>
                  <Text style={styles.adminStatValue}>{adminStats.activeReservationCount}</Text>
                  <Text style={styles.adminStatLabel}>Reservasi Aktif</Text>
                </View>
              </View>
              <View style={styles.adminStatCard}>
                <View style={[styles.adminStatIcon, { backgroundColor: COLORS.accentLight }]}>
                  <Ionicons name="pulse" size={22} color={COLORS.accent} />
                </View>
                <View style={styles.adminStatText}>
                  <Text style={styles.adminStatValue}>{adminStats.pendingCount}</Text>
                  <Text style={styles.adminStatLabel}>Menunggu Konfirmasi</Text>
                </View>
              </View>
            </View>
            )}

            <Text style={styles.sectionTitle}>Pemberitahuan Terbaru</Text>
            <View style={styles.notificationCard}>
              <View style={[styles.notifIconWrapper, { backgroundColor: COLORS.adminPrimaryLight }]}>
                <Ionicons name="sync" size={18} color={COLORS.adminPrimary} />
              </View>
              <View style={styles.notifTextWrapper}>
                <Text style={styles.notifTitle}>Sinkronisasi Sistem</Text>
                <Text style={styles.notifDesc}>Ringkasan dashboard admin sekarang ditarik langsung dari data Supabase yang aktif.</Text>
                <Text style={styles.notifTime}>{adminStats.lastSyncAt ? `Tersinkron ${adminStats.lastSyncAt}` : 'Menunggu sinkronisasi'}</Text>
              </View>
            </View>
            <View style={styles.notificationCard}>
              <View style={[styles.notifIconWrapper, { backgroundColor: COLORS.warningBg }]}>
                <Ionicons name="alert-circle" size={18} color={COLORS.warning} />
              </View>
              <View style={styles.notifTextWrapper}>
                <Text style={styles.notifTitle}>Reservasi Perlu Tinjauan</Text>
                <Text style={styles.notifDesc}>{adminStats.pendingCount > 0 ? `${adminStats.pendingCount} reservasi masih menunggu konfirmasi dokter.` : 'Tidak ada reservasi yang menunggu konfirmasi saat ini.'}</Text>
                <Text style={styles.notifTime}>Status live</Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flexGrow: 1, paddingBottom: 110 },
  
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xxl, paddingTop: 30, paddingBottom: SPACING.lg,
  },
  userInfo: { flex: 1, paddingRight: SPACING.xl },
  greeting: { fontSize: 26, ...FONTS.heading, color: COLORS.textPrimary },
  subtitle: { fontSize: 14, ...FONTS.body, color: COLORS.textMuted, marginTop: 4, lineHeight: 20 },
  avatarContainer: { 
    width: 52, height: 52, borderRadius: RADIUS.xl, 
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  
  content: { paddingHorizontal: SPACING.xxl, marginTop: SPACING.sm },
  sectionTitle: { fontSize: 18, ...FONTS.subheading, color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: SPACING.lg },
  
  // Banner Styles (User)
  bannerCard: { 
    borderRadius: RADIUS.xxl, padding: SPACING.xl, overflow: 'hidden',
    position: 'relative', marginBottom: SPACING.md, ...SHADOWS.md
  },
  bannerTextContainer: { zIndex: 2, paddingRight: 40 },
  bannerTitle: { fontSize: 20, ...FONTS.heading, color: COLORS.textOnPrimary, marginBottom: SPACING.xs },
  bannerDesc: { fontSize: 14, ...FONTS.body, color: 'rgba(255,255,255,0.9)', lineHeight: 20, marginBottom: SPACING.lg },
  bannerBtn: { 
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, 
    borderRadius: RADIUS.pill, alignSelf: 'flex-start'
  },
  bannerBtnText: { ...FONTS.label, fontSize: 14 },
  bannerIcon: { position: 'absolute', right: -15, bottom: -15, zIndex: 1 },
  
  // Action Grid (User)
  actionGrid: { flexDirection: 'row', gap: SPACING.md },
  actionCard: { 
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm, alignItems: 'center'
  },
  iconWrapper: { width: 50, height: 50, borderRadius: RADIUS.pill, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  actionTitle: { fontSize: 14, ...FONTS.label, color: COLORS.textPrimary, textAlign: 'center' },
  
  // Info Card (User)
  infoCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, alignItems: 'center', ...SHADOWS.sm
  },
  iconWrapperSmall: { width: 40, height: 40, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  infoTextWrapper: { flex: 1 },
  infoTitle: { fontSize: 15, ...FONTS.label, color: COLORS.textPrimary, marginBottom: 2 },
  infoDesc: { fontSize: 13, ...FONTS.body, color: COLORS.textMuted, lineHeight: 18 },

  // Stats Row (Legacy User / Simple)
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm, alignItems: 'center'
  },
  statValue: { fontSize: 22, ...FONTS.heading, color: COLORS.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 12, ...FONTS.caption, color: COLORS.textMuted, textAlign: 'center' },
  
  // Admin Content Styles
  adminErrorCard: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  adminErrorText: { fontSize: 13, ...FONTS.body, color: COLORS.danger, lineHeight: 20, marginBottom: SPACING.sm },
  adminRetryBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.pill },
  adminRetryText: { fontSize: 12, ...FONTS.label, color: COLORS.danger },
  adminLoadingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
    alignItems: 'center',
  },
  adminLoadingText: { marginTop: SPACING.sm, fontSize: 13, ...FONTS.body, color: COLORS.textMuted },
  adminStatsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
  },
  adminStatCard: {
    width: '47.5%', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm
  },
  adminStatIcon: {
    width: 44, height: 44, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm
  },
  adminStatText: { flex: 1 },
  adminStatValue: { fontSize: 18, ...FONTS.heading, color: COLORS.textPrimary },
  adminStatLabel: { fontSize: 12, ...FONTS.body, color: COLORS.textMuted },

  notificationCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm, marginBottom: SPACING.md
  },
  notifIconWrapper: {
    width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md
  },
  notifTextWrapper: { flex: 1 },
  notifTitle: { fontSize: 15, ...FONTS.label, color: COLORS.textPrimary, marginBottom: 2 },
  notifDesc: { fontSize: 13, ...FONTS.body, color: COLORS.textMuted, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, ...FONTS.caption, color: COLORS.textDisabled },
});
