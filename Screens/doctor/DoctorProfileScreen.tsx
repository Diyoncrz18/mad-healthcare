/**
 * DoctorProfileScreen — Profil Medis Dokter
 * Menampilkan data profil, statistik total, pengaturan praktik, dan logout.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, Switch, ActivityIndicator,
  TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { getCurrentUser, signOut } from '../services/authService';
import { supabase } from '../../supabase';
import { Doctor } from '../types';

type Stats = { total: number; confirmed: number; selesai: number };

export default function DoctorProfileScreen() {
  const [email, setEmail]       = useState('');
  const [doctor, setDoctor]     = useState<Doctor | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [stats, setStats]       = useState<Stats>({ total: 0, confirmed: 0, selesai: 0 });
  const [loading, setLoading]    = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (doctorError) throw doctorError;

      if (!doctorData) {
        setErrorMessage('Akun dokter ini belum terhubung ke profil dokter. Hubungi admin untuk sinkronisasi data.');
        return;
      }

      setDoctor(doctorData as Doctor);
      setIsActive(doctorData.is_active);
      setEditName(doctorData.name);
      setEditSpecialty(doctorData.specialty || '');

      const { data, error } = await supabase
        .from('appointments')
        .select('status')
        .eq('doctor_id', doctorData.id);

      if (error) throw error;

      if (data) {
        setStats({
          total:     data.length,
          confirmed: data.filter((d: any) => d.status === 'Confirmed').length,
          selesai:   data.filter((d: any) => d.status === 'Selesai').length,
        });
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Gagal memuat profil dokter.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const doctorName = doctor?.name || email.split('@')[0] || 'Dokter';
  const specialty = doctor?.specialty || 'Poli Umum';

  const handleSaveProfile = async () => {
    if (!doctor) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Nama tidak boleh kosong.');
      return;
    }
    try {
      await supabase
        .from('doctors')
        .update({ name: editName, specialty: editSpecialty })
        .eq('id', doctor.id);
      
      setDoctor({ ...doctor, name: editName, specialty: editSpecialty });
      setEditModalVisible(false);
      Alert.alert('Sukses', 'Profil berhasil diperbarui.');
    } catch (error) {
      Alert.alert('Error', 'Gagal memperbarui profil.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Apakah Anda yakin ingin keluar dari portal Dokter?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => { await signOut(); },
        },
      ]
    );
  };

  const handleToggleStatus = async (val: boolean) => {
    if (!doctor) {
      setIsActive(val);
      return;
    }
    try {
      await supabase
        .from('doctors')
        .update({ is_active: val })
        .eq('id', doctor.id);
      
      setIsActive(val);
      Alert.alert(
        'Status Diperbarui',
        `Status praktik Anda sekarang: ${val ? 'Aktif' : 'Cuti / Tidak Tersedia'}`
      );
    } catch (error) {
      setIsActive(!val);
      Alert.alert('Error', 'Gagal memperbarui status.');
    }
  };

  const StatItem = ({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) => (
    <View style={[styles.statItem, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.errorBtn} onPress={() => { setLoading(true); setErrorMessage(''); loadProfile(); }}>
              <Text style={styles.errorBtnText}>Muat Ulang</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil Medis</Text>
        </View>

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Ionicons name="medkit" size={32} color={COLORS.doctorPrimary} />
              </View>
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.nameText}>Dr. {doctor?.name || doctorName}</Text>
              <Text style={styles.specialtyText}>{specialty}</Text>
              <View style={[styles.activeBadge, { backgroundColor: isActive ? COLORS.successBg : COLORS.inputBg }]}>
                <View style={[styles.activeDot, { backgroundColor: isActive ? COLORS.success : COLORS.border }]} />
                <Text style={[styles.activeLabel, { color: isActive ? COLORS.success : COLORS.textMuted }]}>
                  {isActive ? 'Aktif Praktik' : 'Sedang Cuti'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>{email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoText}>ID Medis: {doctor?.id?.substring(0, 8).toUpperCase() || '-'}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.editProfileBtn}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.doctorPrimary} />
            <Text style={styles.editProfileText}>Edit Profil</Text>
          </TouchableOpacity>
        </View>

        {/* ── Statistics ── */}
        <Text style={styles.sectionTitle}>Statistik Konsultasi</Text>
        <View style={styles.statsRow}>
          <StatItem value={stats.total}     label="Total"     color={COLORS.doctorPrimary} bg={COLORS.doctorPrimaryLight} />
          <StatItem value={stats.confirmed} label="Aktif"     color={COLORS.info}          bg={COLORS.infoBg} />
          <StatItem value={stats.selesai}   label="Selesai"   color={COLORS.success}       bg={COLORS.successBg} />
        </View>

        {/* ── Settings ── */}
        <Text style={styles.sectionTitle}>Pengaturan Praktik</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingItem}>
            <View style={[styles.settingIconBox, { backgroundColor: COLORS.doctorPrimaryLight }]}>
              <Ionicons name="pulse" size={20} color={COLORS.doctorPrimary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Status Praktik</Text>
              <Text style={styles.settingSub}>Kontrol visibilitas antrean pasien</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={handleToggleStatus}
              trackColor={{ false: COLORS.border, true: COLORS.doctorPrimaryLight }}
              thumbColor={isActive ? COLORS.doctorPrimary : COLORS.surface}
            />
          </View>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIconBox, { backgroundColor: COLORS.infoBg }]}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.info} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Notifikasi</Text>
              <Text style={styles.settingSub}>Pemberitahuan request pasien baru</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.settingDivider} />

          <TouchableOpacity style={styles.settingItem}>
            <View style={[styles.settingIconBox, { backgroundColor: COLORS.successBg }]}>
              <Ionicons name="time-outline" size={20} color={COLORS.success} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Jam Praktik</Text>
              <Text style={styles.settingSub}>08:00 — 17:00 WIB</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutBtnText}>Keluar dari Portal Dokter</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profil</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nama Lengkap</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nama lengkap dokter"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.inputLabel}>Spesialisasi</Text>
            <TextInput
              style={styles.input}
              value={editSpecialty}
              onChangeText={setEditSpecialty}
              placeholder="Contoh: Poli Gigi, Poli Anak"
              placeholderTextColor={COLORS.textMuted}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: SPACING.xl, paddingBottom: 120 },

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
  header: { marginBottom: SPACING.xl, paddingTop: 10 },
  headerTitle: { fontSize: 26, ...FONTS.heading, color: COLORS.textPrimary },

  profileCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.md, marginBottom: SPACING.xxl,
  },
  avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  avatarRing: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 2,
    borderColor: COLORS.doctorPrimary, justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.lg,
  },
  avatar: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: COLORS.doctorPrimaryLight, justifyContent: 'center', alignItems: 'center',
  },
  nameBlock: { flex: 1 },
  nameText: { ...FONTS.heading, fontSize: 20, color: COLORS.textPrimary, marginBottom: 2 },
  specialtyText: { ...FONTS.label, fontSize: 13, color: COLORS.doctorPrimary, marginBottom: SPACING.sm },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  activeLabel: { ...FONTS.label, fontSize: 11 },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: SPACING.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: 10 },
  infoText: { ...FONTS.body, fontSize: 14, color: COLORS.textSecondary },

  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.doctorPrimaryLight, paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg, marginTop: SPACING.md, gap: SPACING.sm,
  },
  editProfileText: { ...FONTS.label, fontSize: 14, color: COLORS.doctorPrimary },

  sectionTitle: { ...FONTS.subheading, fontSize: 16, color: COLORS.textPrimary, marginBottom: SPACING.md },

  statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xxl },
  statItem: { flex: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center' },
  statValue: { ...FONTS.heading, fontSize: 24, marginBottom: 2 },
  statLabel: { ...FONTS.caption, fontSize: 12 },

  settingsCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm, marginBottom: SPACING.xxl,
    overflow: 'hidden',
  },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg },
  settingIconBox: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  settingText: { flex: 1 },
  settingLabel: { ...FONTS.label, fontSize: 15, color: COLORS.textPrimary, marginBottom: 2 },
  settingSub: { ...FONTS.caption, fontSize: 12, color: COLORS.textMuted },
  settingDivider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.lg },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutBtnText: { ...FONTS.label, fontSize: 15, color: COLORS.danger },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl + 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  modalTitle: { ...FONTS.heading, fontSize: 20, color: COLORS.textPrimary },

  inputLabel: { ...FONTS.label, fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  input: {
    backgroundColor: COLORS.inputBg, borderRadius: RADIUS.lg, padding: SPACING.lg,
    ...FONTS.body, color: COLORS.textPrimary, marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.borderLight,
  },

  saveBtn: {
    backgroundColor: COLORS.doctorPrimary, paddingVertical: SPACING.lg, borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  saveBtnText: { ...FONTS.label, fontSize: 16, color: COLORS.surface },
});