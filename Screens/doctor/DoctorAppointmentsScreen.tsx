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
  SafeAreaView,
  SectionList,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
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
};

type FilterKey = 'Semua' | 'pending' | 'Confirmed' | 'Selesai' | 'Cancelled';

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
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

const avatarPalette = (status: string): { bg: string; fg: string } => {
  if (status === 'pending') return { bg: COLORS.warningBg, fg: COLORS.warningText };
  if (status === 'Confirmed') return { bg: COLORS.primaryLight, fg: COLORS.primary };
  if (status === 'Selesai') return { bg: COLORS.successBg, fg: COLORS.successText };
  if (status === 'Cancelled') return { bg: COLORS.dangerBg, fg: COLORS.dangerText };
  return { bg: COLORS.borderLight, fg: COLORS.textSecondary };
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
    newStatus: 'Confirmed' | 'Cancelled' | 'Selesai',
    patientName: string
  ) => {
    const labels: Record<string, string> = {
      Confirmed: 'Konfirmasi',
      Cancelled: 'Tolak',
      Selesai: 'Tandai Selesai',
    };
    const messages: Record<string, string> = {
      Confirmed: `Konfirmasi jadwal dari ${patientName}?`,
      Cancelled: `Tolak permintaan dari ${patientName}? Pasien akan diberi tahu.`,
      Selesai: `Tandai sesi konsultasi ${patientName} telah selesai?`,
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

  // ── Derived data ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = {
      Semua: appointments.length,
      pending: 0,
      Confirmed: 0,
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
          <AppointmentCard item={item} onAction={handleAction} />
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
  onAction,
}: {
  item: Appointment;
  onAction: (
    id: string,
    newStatus: 'Confirmed' | 'Cancelled' | 'Selesai',
    patientName: string
  ) => void;
}) => {
  const isPending = item.status === 'pending';
  const isConfirmed = item.status === 'Confirmed';

  const time = extractTime(item);
  const dateStr = formatLongDate(parseAppointmentDate(item));
  const palette = avatarPalette(item.status);

  return (
    <Card variant="default" padding="lg" style={styles.cardSpacing}>
      {/* Top: Time + Status */}
      <View style={styles.cardTop}>
        <View style={styles.timeBadge}>
          <Ionicons name="time-outline" size={14} color={COLORS.primary} />
          <Text style={styles.timeBadgeText}>{time}</Text>
        </View>
        <StatusBadge kind={statusToKind(item.status)} />
      </View>

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
            />
          </View>
        </View>
      )}

      {isConfirmed && (
        <Button
          label="Tandai Selesai"
          onPress={() => onAction(item.id, 'Selesai', item.patient_name)}
          variant="primary"
          icon="checkmark-done"
          iconPosition="left"
          size="md"
          fullWidth
        />
      )}
    </Card>
  );
};

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

  // Actions
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
});
