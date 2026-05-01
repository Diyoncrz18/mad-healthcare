/**
 * MyAppointmentsScreen — Riwayat & Manajemen Antrean.
 * Shared screen: User melihat janjinya, Admin mengelola seluruh antrean.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { Appointment, UserRole } from '../types';
import { getCurrentUser } from '../services/authService';
import {
  fetchAppointments as fetchAppointmentsService,
  updateAppointmentStatus,
  deleteAppointment,
} from '../services/appointmentService';
import { supabase } from '../../supabase';
import {
  ScreenHeader,
  Card,
  Button,
  StatusBadge,
  IconBadge,
  LoadingState,
  EmptyState,
} from '../components/ui';
import type { StatusKind } from '../components/ui';

const FILTER_OPTIONS = ['Semua', 'Menunggu', 'Dikonfirmasi', 'Diproses', 'Selesai', 'Dibatalkan'] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

const FILTER_TO_STATUS: Record<FilterOption, string | null> = {
  Semua: null,
  Menunggu: 'pending',
  Dikonfirmasi: 'Confirmed',
  Diproses: 'Diproses',
  Selesai: 'Selesai',
  Dibatalkan: 'Cancelled',
};

const statusToKind = (status: string): StatusKind => {
  if (status === 'pending') return 'pending';
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Diproses') return 'processing';
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

const accentForStatus = (status: string): string => {
  if (status === 'pending') return COLORS.warning;
  if (status === 'Confirmed') return COLORS.primary;
  if (status === 'Diproses') return COLORS.info;
  if (status === 'Selesai') return COLORS.success;
  return COLORS.border;
};

type InvoiceNoteKey = 'diagnosis' | 'treatment' | 'prescription' | 'advice';
type InvoiceNoteFields = Record<InvoiceNoteKey, string>;

const NOTE_SECTIONS: {
  key: InvoiceNoteKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'diagnosis', label: 'Diagnosis / Kesimpulan', icon: 'medkit-outline' },
  { key: 'treatment', label: 'Tindakan / Terapi', icon: 'bandage-outline' },
  { key: 'prescription', label: 'Resep / Obat', icon: 'flask-outline' },
  { key: 'advice', label: 'Saran / Rencana Lanjut', icon: 'clipboard-outline' },
];

const EMPTY_NOTE_FIELDS: InvoiceNoteFields = {
  diagnosis: '',
  treatment: '',
  prescription: '',
  advice: '',
};

const parseConsultationNote = (note?: string | null): InvoiceNoteFields => {
  const fields: InvoiceNoteFields = { ...EMPTY_NOTE_FIELDS };
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

const formatIDR = (value?: number | null): string =>
  typeof value === 'number' && value > 0
    ? 'Rp ' + Math.round(value).toLocaleString('id-ID')
    : 'Belum tercatat';

export default function MyAppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('Semua');
  const [invoiceTarget, setInvoiceTarget] = useState<Appointment | null>(null);

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

  useEffect(() => {
    const channel = supabase
      .channel('appointments-user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => loadAppointments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredAppointments = useMemo(() => {
    const target = FILTER_TO_STATUS[activeFilter];
    if (!target) return appointments;
    return appointments.filter((a) => a.status === target);
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
      if (window.confirm('Hapus arsip jadwal ini secara permanen?')) doDelete();
    } else {
      Alert.alert(
        'Konfirmasi Hapus Data',
        'Hapus data jadwal ini secara permanen?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Hapus Permanen', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const isUser = userRole === 'user';

    return (
      <Card
        variant="accent"
        accentColor={accentForStatus(item.status)}
        padding="md"
        style={{ marginBottom: SPACING.md }}
      >
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <IconBadge
              icon={isUser ? 'medkit' : 'person'}
              tone={isUser ? 'brand' : 'admin'}
              size="md"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryName} numberOfLines={1}>
                {isUser ? item.doctor_name : item.patient_name || 'Anonim'}
              </Text>
              <Text style={styles.idText}>
                ID #{item.id.substring(0, 8).toUpperCase()}
              </Text>
            </View>
          </View>
          <StatusBadge kind={statusToKind(item.status)} />
        </View>

        <View style={styles.divider} />

        {isUser ? (
          <DetailRow icon="person" label="Pasien" value={item.patient_name || 'Anonim'} />
        ) : (
          <DetailRow icon="medkit" label="Dokter" value={item.doctor_name} />
        )}
        <DetailRow icon="calendar-outline" label="Waktu" value={item.date} />
        <DetailRow
          icon="document-text"
          label="Keluhan"
          value={item.symptoms || '—'}
          multiline
        />

        {/* Actions */}
        <View style={styles.actions}>
          {userRole === 'admin' ? (
            <>
              {item.status === 'pending' && (
                <>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Tolak"
                      onPress={() => handleUpdateStatus(item.id, 'Cancelled')}
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
                      label="Terima Permintaan"
                      onPress={() => handleUpdateStatus(item.id, 'Confirmed')}
                      variant="success"
                      icon="checkmark"
                      iconPosition="left"
                      size="md"
                      fullWidth
                    />
                  </View>
                </>
              )}
              {item.status === 'Confirmed' && (
                <Button
                  label="Tandai Selesai"
                  onPress={() => handleUpdateStatus(item.id, 'Selesai')}
                  variant="primary"
                  icon="flag"
                  iconPosition="left"
                  size="md"
                  fullWidth
                />
              )}
              {(item.status === 'Cancelled' || item.status === 'Selesai') && (
                <Button
                  label="Hapus Catatan"
                  onPress={() => handleDelete(item.id)}
                  variant="outline"
                  icon="trash"
                  iconPosition="left"
                  size="md"
                  fullWidth
                  textStyle={{ color: COLORS.danger }}
                />
              )}
            </>
          ) : (
            <>
              {item.status === 'pending' && (
                <Button
                  label="Batalkan Janji"
                  onPress={() => handleUpdateStatus(item.id, 'Cancelled')}
                  variant="outline"
                  icon="close-circle-outline"
                  iconPosition="left"
                  size="md"
                  fullWidth
                />
              )}
              {item.status === 'Selesai' && (
                <Button
                  label="Lihat Nota"
                  onPress={() => setInvoiceTarget(item)}
                  variant="success"
                  icon="receipt"
                  iconPosition="left"
                  size="md"
                  fullWidth
                />
              )}
            </>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={userRole === 'admin' ? 'Manajemen Antrean' : 'Riwayat & Janji'}
        subtitle={
          userRole === 'admin'
            ? 'Tinjau dan kelola jadwal masuk dari pasien.'
            : 'Pantau jejak reservasi konsultasi yang pernah Anda buat.'
        }
      />

      {/* Filter Chips */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[styles.chip, isActive && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <LoadingState fullscreen label="Menyinkronkan data…" />
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onRefresh={loadAppointments}
          refreshing={loading}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="filter-circle-outline"
              title="Kategori Kosong"
              description={`Belum ada data jadwal untuk filter "${activeFilter}".`}
            />
          }
        />
      )}

      <PatientInvoiceModal
        visible={!!invoiceTarget}
        appointment={invoiceTarget}
        onClose={() => setInvoiceTarget(null)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────
const DetailRow = ({
  icon,
  label,
  value,
  multiline = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) => (
  <View style={[styles.detailRow, multiline && { alignItems: 'flex-start' }]}>
    <Ionicons
      name={icon}
      size={14}
      color={COLORS.textMuted}
      style={[styles.detailIcon, multiline && { marginTop: 2 }]}
    />
    <Text style={styles.detailLabel} numberOfLines={multiline ? 0 : 1}>
      <Text style={styles.detailLabelMuted}>{label}: </Text>
      <Text style={styles.detailValue}>{value}</Text>
    </Text>
  </View>
);

const PatientInvoiceModal = ({
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
              <Text style={styles.modalEyebrow}>Nota Konsultasi</Text>
              <Text style={styles.modalTitle}>Ringkasan Pemeriksaan</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Tutup nota konsultasi"
            >
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {!!appointment && (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.invoiceHero}>
                <View style={styles.invoiceHeroIcon}>
                  <Ionicons name="receipt-outline" size={22} color={COLORS.successText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoicePatientName} numberOfLines={1}>
                    {appointment.patient_name || 'Pasien'}
                  </Text>
                  <Text style={styles.invoiceMeta} numberOfLines={2}>
                    {appointment.doctor_name || 'Dokter'} • {appointment.date}
                  </Text>
                </View>
              </View>

              <View style={styles.feeBox}>
                <Text style={styles.feeLabel}>Total Biaya</Text>
                <Text style={styles.feeValue}>{formatIDR(appointment.consultation_fee)}</Text>
              </View>

              <View style={styles.complaintBox}>
                <Text style={styles.sectionMiniLabel}>Keluhan Utama</Text>
                <Text style={styles.noteBodyText}>
                  {appointment.symptoms || 'Tidak ada data keluhan.'}
                </Text>
              </View>

              {NOTE_SECTIONS.map((section) => {
                const value = fields[section.key].trim();
                return (
                  <View key={section.key} style={styles.noteSection}>
                    <View style={styles.noteSectionHead}>
                      <View style={styles.noteSectionIcon}>
                        <Ionicons name={section.icon} size={15} color={COLORS.primary} />
                      </View>
                      <Text style={styles.noteSectionTitle}>{section.label}</Text>
                    </View>
                    <Text style={styles.noteBodyText}>
                      {value || 'Belum ada catatan.'}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Button
            label="Tutup Nota"
            onPress={onClose}
            variant="primary"
            icon="checkmark"
            iconPosition="left"
            size="md"
            fullWidth
            style={styles.closeInvoiceButton}
          />
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Filter
  filterWrap: { marginBottom: SPACING.md },
  filterScroll: { paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPO.labelSm, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.textOnPrimary },

  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
  },

  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  cardHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  primaryName: { ...TYPO.h4, color: COLORS.textPrimary },
  idText: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailIcon: { width: 14 },
  detailLabel: { ...TYPO.bodySm, color: COLORS.textPrimary, flex: 1 },
  detailLabelMuted: { color: COLORS.textMuted, fontWeight: '500' },
  detailValue: { color: COLORS.textPrimary, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
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
    maxHeight: '90%',
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
  modalScroll: {
    maxHeight: 560,
  },
  modalScrollContent: {
    paddingBottom: SPACING.sm,
  },
  invoiceHero: {
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
  invoiceHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.successBg,
  },
  invoicePatientName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
  },
  invoiceMeta: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  feeBox: {
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
  feeLabel: {
    ...TYPO.labelSm,
    color: COLORS.textMuted,
  },
  feeValue: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
  },
  complaintBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundAlt,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionMiniLabel: {
    ...TYPO.overline,
    color: COLORS.textMuted,
  },
  noteSection: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  noteSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  noteSectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  noteSectionTitle: {
    ...TYPO.labelSm,
    color: COLORS.textPrimary,
  },
  noteBodyText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  closeInvoiceButton: {
    marginTop: SPACING.md,
  },
});
