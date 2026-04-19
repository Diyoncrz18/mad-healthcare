/**
 * DoctorAppointmentsScreen — Manajemen Antrean & Request Pasien
 * Terhubung ke Supabase. Dokter bisa:
 * - Melihat semua request/appointment berdasarkan namanya
 * - Filter per status (Semua / Baru / Dikonfirmasi / Selesai)
 * - Terima atau tolak request baru
 * - Tandai konsultasi selesai
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import { updateAppointmentStatus } from '../services/appointmentService';

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

type FilterKey = 'Semua' | 'pending' | 'Confirmed' | 'Selesai' | 'Cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'Semua',     label: 'Semua' },
  { key: 'pending',   label: 'Request Baru' },
  { key: 'Confirmed', label: 'Dikonfirmasi' },
  { key: 'Selesai',   label: 'Selesai' },
  { key: 'Cancelled', label: 'Dibatalkan' },
];

export default function DoctorAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState<FilterKey>('Semua');
  const [doctorNameKey, setDoctorNameKey] = useState('');

  /* ─── Load Data ───────────────────────────────────────────── */
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

      setDoctorNameKey(doctorData?.name || '');

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat antrean dokter.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Realtime subscription untuk appointment
  React.useEffect(() => {
    const channel = supabase
      .channel('appointments-doctor')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointments' }, (payload) => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  /* ─── Action Handler ──────────────────────────────────────── */
  const handleAction = (
    id: string,
    newStatus: 'Confirmed' | 'Cancelled' | 'Selesai',
    patientName: string
  ) => {
    const labels: Record<string, string> = {
      Confirmed: 'Konfirmasi',
      Cancelled: 'Tolak',
      Selesai: 'Tandai Selesai',
    };
    Alert.alert(
      labels[newStatus],
      newStatus === 'Confirmed'
        ? `Konfirmasi jadwal dari ${patientName}?`
        : newStatus === 'Cancelled'
        ? `Tolak permintaan dari ${patientName}? Pasien akan diberi tahu.`
        : `Tandai sesi konsultasi ${patientName} telah selesai?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: labels[newStatus],
          style: newStatus === 'Cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .update({ status: newStatus })
              .eq('id', id);
            if (error) Alert.alert('Error', error.message);
            else loadData();
          },
        },
      ]
    );
  };

  /* ─── Filtered Data ───────────────────────────────────────── */
  const filtered = filter === 'Semua'
    ? appointments
    : appointments.filter(a => a.status === filter);

  /* ─── Render Item ─────────────────────────────────────────── */
  const renderItem = ({ item }: { item: Appointment }) => {
    const isPending    = item.status === 'pending';
    const isConfirmed  = item.status === 'Confirmed';
    const isDone       = item.status === 'Selesai';
    const isCancelled  = item.status === 'Cancelled';

    const borderColor = isPending   ? COLORS.warning
                      : isConfirmed ? COLORS.doctorPrimary
                      : isDone      ? COLORS.success
                      :               COLORS.border;

    const statusLabel = isPending   ? 'Menunggu Konfirmasi'
                      : isConfirmed ? 'Dikonfirmasi'
                      : isDone      ? 'Selesai'
                      :               'Dibatalkan';

    const statusColor = isPending   ? COLORS.warning
                      : isConfirmed ? COLORS.doctorPrimary
                      : isDone      ? COLORS.success
                      :               COLORS.textMuted;

    const statusBg    = isPending   ? COLORS.warningBg
                      : isConfirmed ? COLORS.doctorPrimaryLight
                      : isDone      ? COLORS.successBg
                      :               COLORS.inputBg;

    return (
      <View style={[styles.card, { borderLeftColor: borderColor }]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.dateText} numberOfLines={1}>
            {item.date.split(' | ')[0] || item.date}
          </Text>
        </View>

        {/* Patient Info */}
        <View style={styles.patientRow}>
          <View style={[styles.avatar, { backgroundColor: isPending ? COLORS.warningBg : COLORS.doctorPrimaryLight }]}>
            <Text style={[styles.avatarText, { color: isPending ? COLORS.warning : COLORS.doctorPrimary }]}>
              {item.patient_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.patientDetails}>
            <Text style={styles.patientName}>{item.patient_name}</Text>
            <Text style={styles.timeText}>
              <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />{' '}
              {item.date.split(' | ')[1] || '—'}
            </Text>
          </View>
        </View>

        {/* Keluhan */}
        <View style={styles.complaintBox}>
          <Text style={styles.complaintLabel}>Keluhan Utama</Text>
          <Text style={styles.complaintText}>{item.symptoms}</Text>
        </View>

        {/* Actions */}
        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleAction(item.id, 'Cancelled', item.patient_name)}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
              <Text style={styles.rejectBtnText}>Tolak</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleAction(item.id, 'Confirmed', item.patient_name)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.textOnPrimary} />
              <Text style={styles.confirmBtnText}>Konfirmasi</Text>
            </TouchableOpacity>
          </View>
        )}
        {isConfirmed && (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => handleAction(item.id, 'Selesai', item.patient_name)}
          >
            <Ionicons name="checkmark-done" size={16} color={COLORS.success} />
            <Text style={styles.doneBtnText}>Tandai Selesai</Text>
          </TouchableOpacity>
        )}
      </View>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Antrean & Request</Text>
        <Text style={styles.headerSubtitle}>
          {appointments.filter(a => a.status === 'pending').length > 0
            ? `${appointments.filter(a => a.status === 'pending').length} permintaan baru menunggu`
            : 'Kelola jadwal konsultasi harian Anda.'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
                {f.label}
              </Text>
              {f.key !== 'Semua' && f.key !== 'Cancelled' && (
                <View style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, filter === f.key && styles.filterCountTextActive]}>
                    {appointments.filter(a => a.status === f.key).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={loadData}>
            <Text style={styles.errorBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.doctorPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={52} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Tidak ada antrean</Text>
            <Text style={styles.emptyText}>
              {filter === 'Semua'
                ? 'Belum ada pasien yang membuat janji dengan Anda.'
                : `Tidak ada jadwal dengan status "${FILTERS.find(f => f.key === filter)?.label}".`}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: SPACING.xxl, paddingTop: 30, paddingBottom: SPACING.md },
  headerTitle: { fontSize: 26, ...FONTS.heading, color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 13, ...FONTS.body, color: COLORS.textMuted, marginTop: SPACING.xs },

  filterWrapper: { marginBottom: SPACING.md },
  filterList: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  filterChipActive: { backgroundColor: COLORS.doctorPrimary, borderColor: COLORS.doctorPrimary },
  filterLabel: { ...FONTS.label, fontSize: 13, color: COLORS.textMuted },
  filterLabelActive: { color: COLORS.textOnPrimary },
  filterCount: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.inputBg,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { ...FONTS.label, fontSize: 11, color: COLORS.textMuted },
  filterCountTextActive: { color: COLORS.textOnPrimary },

  errorCard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.dangerBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { ...FONTS.body, fontSize: 13, color: COLORS.danger, lineHeight: 20, marginBottom: SPACING.sm },
  errorBtn: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.pill },
  errorBtnText: { ...FONTS.label, fontSize: 12, color: COLORS.danger },
  listContainer: { paddingHorizontal: SPACING.xl, paddingBottom: 110 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderLeftWidth: 4, borderColor: COLORS.borderLight,
    ...SHADOWS.sm, marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { ...FONTS.label, fontSize: 12 },
  dateText: { ...FONTS.caption, fontSize: 12, color: COLORS.textMuted, maxWidth: 140 },

  patientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  avatarText: { ...FONTS.heading, fontSize: 20 },
  patientDetails: { flex: 1 },
  patientName: { ...FONTS.subheading, fontSize: 16, color: COLORS.textPrimary },
  timeText: { ...FONTS.caption, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  complaintBox: { backgroundColor: COLORS.background, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.md },
  complaintLabel: { ...FONTS.label, fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  complaintText: { ...FONTS.body, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: SPACING.md },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  rejectBtnText: { ...FONTS.label, fontSize: 13, color: COLORS.danger },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.doctorPrimary,
  },
  confirmBtnText: { ...FONTS.label, fontSize: 13, color: COLORS.textOnPrimary },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.successBg, borderWidth: 1, borderColor: 'rgba(22,163,74,0.2)',
  },
  doneBtnText: { ...FONTS.label, fontSize: 13, color: COLORS.success },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: SPACING.xxl },
  emptyTitle: { ...FONTS.subheading, fontSize: 16, color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  emptyText: { ...FONTS.body, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
