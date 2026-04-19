/**
 * MyAppointmentsScreen — Riwayat Medis & Manajemen Antrean
 * Shared screen: menampilkan daftar appointment dengan filter.
 * - User: melihat riwayat janji sendiri.
 * - Admin: melihat + mengelola seluruh antrean pasien.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Platform, SafeAreaView, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { Appointment, UserRole } from '../types';
import { getCurrentUser } from '../services/authService';
import {
  fetchAppointments as fetchAppointmentsService,
  updateAppointmentStatus,
  deleteAppointment,
} from '../services/appointmentService';
import { supabase } from '../../supabase';

const FILTER_OPTIONS = ['Semua', 'Menunggu', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'];

export default function MyAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [activeFilter, setActiveFilter] = useState('Semua');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (user) {
        const role = (user.user_metadata?.role || 'user') as UserRole;
        setUserRole(role);
        const data = await fetchAppointmentsService(user.id, role);
        setAppointments(data);
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengambil Data', err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadAppointments(); }, []);

  // Realtime subscription
  React.useEffect(() => {
    const channel = supabase
      .channel('appointments-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadAppointments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredAppointments = useMemo(() => {
    if (activeFilter === 'Semua') return appointments;
    if (activeFilter === 'Menunggu') return appointments.filter((a) => a.status === 'pending');
    if (activeFilter === 'Dikonfirmasi') return appointments.filter((a) => a.status === 'Confirmed');
    if (activeFilter === 'Selesai') return appointments.filter((a) => a.status === 'Selesai');
    if (activeFilter === 'Dibatalkan') return appointments.filter((a) => a.status === 'Cancelled');
    return appointments;
  }, [appointments, activeFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updateAppointmentStatus(id, newStatus as any);
      loadAppointments();
    } catch (err: any) {
      Alert.alert('Gagal Update', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const doDelete = async () => {
      try {
        await deleteAppointment(id);
        loadAppointments();
      } catch (err: any) {
        Alert.alert('Gagal Menghapus', err.message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Apakah Anda yakin ingin menghapus arsip jadwal ini permanen?')) doDelete();
    } else {
      Alert.alert('Konfirmasi Hapus Data', 'Apakah Anda yakin ingin menghapus data jadwal ini secara permanen?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus Permanen', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const getStatusDisplay = (status: string) => {
    if (status === 'Confirmed') return { label: 'Dikonfirmasi', bg: COLORS.successBg, text: COLORS.successText, icon: 'checkmark-circle' as const };
    if (status === 'Cancelled') return { label: 'Dibatalkan', bg: COLORS.dangerBg, text: COLORS.dangerText, icon: 'close-circle' as const };
    if (status === 'Selesai') return { label: 'Selesai', bg: COLORS.completeBg, text: COLORS.completeText, icon: 'flag' as const };
    return { label: 'Menunggu', bg: COLORS.warningBg, text: COLORS.warningText, icon: 'time' as const };
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const isUser = userRole === 'user';
    const primaryColor = isUser ? COLORS.userPrimary : COLORS.adminPrimary;
    const statusInfo = getStatusDisplay(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.doctorIconContainer, { backgroundColor: isUser ? COLORS.userPrimaryLight : COLORS.adminPrimaryLight }]}>
              <Ionicons name={isUser ? 'medkit' : 'person'} size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorText} numberOfLines={1}>
                {isUser ? item.doctor_name : item.patient_name || 'Anonim'}
              </Text>
              <Text style={styles.idText}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={12} color={statusInfo.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {isUser ? (
          <View style={styles.detailRow}>
            <Ionicons name="person" size={16} color={COLORS.textMuted} style={styles.detailIcon} />
            <Text style={styles.detailLabel}>Pasien: <Text style={styles.detailValue}>{item.patient_name || 'Anonim'}</Text></Text>
          </View>
        ) : (
          <View style={styles.detailRow}>
            <Ionicons name="medkit" size={16} color={COLORS.textMuted} style={styles.detailIcon} />
            <Text style={styles.detailLabel}>Dokter: <Text style={styles.detailValue}>{item.doctor_name}</Text></Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} style={styles.detailIcon} />
          <Text style={styles.detailLabel}>Waktu Reservasi: <Text style={styles.detailValue}>{item.date}</Text></Text>
        </View>
        <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
          <Ionicons name="document-text" size={16} color={COLORS.textMuted} style={[styles.detailIcon, { marginTop: 2 }]} />
          <Text style={[styles.detailLabel, { flex: 1 }]}>Keluhan: <Text style={styles.detailValue}>{item.symptoms || '-'}</Text></Text>
        </View>

        <View style={styles.actionContainer}>
          {userRole === 'admin' ? (
            <>
              {item.status === 'pending' && (
                <>
                  <TouchableOpacity style={[styles.actionBtn, styles.btnReject]} onPress={() => handleUpdateStatus(item.id, 'Cancelled')}>
                    <Ionicons name="close" size={16} color={COLORS.danger} style={styles.btnIcon} />
                    <Text style={styles.btnTextReject}>Tolak Reservasi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.btnConfirm]} onPress={() => handleUpdateStatus(item.id, 'Confirmed')}>
                    <Ionicons name="checkmark" size={16} color={COLORS.textOnPrimary} style={styles.btnIcon} />
                    <Text style={styles.btnTextWhite}>Terima Permintaan</Text>
                  </TouchableOpacity>
                </>
              )}
              {item.status === 'Confirmed' && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnSelesai]} onPress={() => handleUpdateStatus(item.id, 'Selesai')}>
                  <Ionicons name="flag" size={16} color={COLORS.textOnPrimary} style={styles.btnIcon} />
                  <Text style={styles.btnTextWhite}>Tandai Selesai</Text>
                </TouchableOpacity>
              )}
              {(item.status === 'Cancelled' || item.status === 'Selesai') && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnRemove]} onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash" size={16} color={COLORS.textOnPrimary} style={styles.btnIcon} />
                  <Text style={styles.btnTextWhite}>Hapus Catatan</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {item.status === 'pending' && (
                <TouchableOpacity style={[styles.actionBtn, styles.btnCancelUser]} onPress={() => handleUpdateStatus(item.id, 'Cancelled')}>
                  <Ionicons name="close-circle-outline" size={16} color={COLORS.textSecondary} style={styles.btnIcon} />
                  <Text style={styles.btnTextCancel}>Batalkan Janji Ini</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="filter-circle-outline" size={48} color={COLORS.textDisabled} />
      </View>
      <Text style={styles.emptyTitle}>Kategori Kosong</Text>
      <Text style={styles.emptyText}>Belum ada data jadwal masuk untuk filter "{activeFilter}" saat ini.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {userRole === 'admin' ? 'Manajemen Antrean' : 'Riwayat Medis & Janji'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {userRole === 'admin' ? 'Tinjau dan kelola jadwal masuk dari pasien.' : 'Pantau jejak reservasi konsultasi yang pernah Anda buat.'}
          </Text>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTER_OPTIONS.map((filter) => {
              const isActive = activeFilter === filter;
              const activeThemeColor = userRole === 'admin' ? COLORS.adminPrimary : COLORS.userPrimary;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, isActive && { backgroundColor: activeThemeColor, borderColor: activeThemeColor }]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={userRole === 'admin' ? COLORS.adminPrimary : COLORS.userPrimary} />
            <Text style={styles.loadingText}>Menyinkronkan data...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredAppointments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={renderEmptyComponent}
            onRefresh={loadAppointments}
            refreshing={loading}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  screenContainer: { flex: 1 },
  header: { paddingHorizontal: SPACING.xxl, paddingTop: 30, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 15, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 22 },
  filterContainer: { marginBottom: 10 },
  filterScroll: { paddingHorizontal: SPACING.xxl, paddingBottom: 10 },
  filterChip: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl, marginRight: 10, borderWidth: 1.5, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  filterText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 14 },
  filterTextActive: { color: COLORS.textOnPrimary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.md, color: COLORS.textMuted, fontSize: 15, fontWeight: '500' },
  listContent: { paddingHorizontal: SPACING.xxl, paddingBottom: 40, paddingTop: 10 },
  card: {
    backgroundColor: COLORS.surface, padding: SPACING.xl, marginBottom: SPACING.xl, borderRadius: RADIUS.xxl,
    ...SHADOWS.md, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: SPACING.md },
  doctorIconContainer: { width: 44, height: 44, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  doctorText: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  idText: { fontSize: 12, color: COLORS.textDisabled, marginTop: 2, fontWeight: '500' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.xl },
  badgeText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.lg },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailIcon: { marginRight: SPACING.sm },
  detailLabel: { fontSize: 14, color: COLORS.textMuted },
  detailValue: { color: COLORS.textPrimary, fontWeight: '600' },
  actionContainer: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: SPACING.xl },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, justifyContent: 'center' },
  btnIcon: { marginRight: 6 },
  btnConfirm: { backgroundColor: COLORS.userPrimary, shadowColor: COLORS.userPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  btnReject: { backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#FECACA' },
  btnSelesai: { backgroundColor: COLORS.adminPrimary, shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  btnRemove: { backgroundColor: '#475569' },
  btnCancelUser: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border },
  btnTextWhite: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 14 },
  btnTextReject: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },
  btnTextCancel: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: SPACING.xl },
  emptyIconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 15, lineHeight: 22 },
});
