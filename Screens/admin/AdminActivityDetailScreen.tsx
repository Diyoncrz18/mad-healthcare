/**
 * AdminActivityDetailScreen - Detail aktivitas reservasi untuk dashboard admin.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { COLORS, LAYOUT, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import { Appointment, AppointmentStatus } from '../types';
import {
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  LoadingState,
  ScreenHeader,
  StatusBadge,
} from '../components/ui';
import type { StatusKind } from '../components/ui';

type FilterKey = 'all' | AppointmentStatus;

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'all', label: 'Semua', icon: 'layers-outline' },
  { key: 'pending', label: 'Menunggu', icon: 'time-outline' },
  { key: 'Confirmed', label: 'Konfirmasi', icon: 'checkmark-circle-outline' },
  { key: 'Diproses', label: 'Diproses', icon: 'pulse-outline' },
  { key: 'Selesai', label: 'Selesai', icon: 'flag-outline' },
  { key: 'Cancelled', label: 'Batal', icon: 'close-circle-outline' },
];

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: 'Menunggu',
  Confirmed: 'Dikonfirmasi',
  Diproses: 'Diproses',
  Cancelled: 'Dibatalkan',
  Selesai: 'Selesai',
};

const statusToKind = (status: string): StatusKind => {
  if (status === 'pending') return 'pending';
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Diproses') return 'processing';
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

const formatDateShort = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const splitAppointmentDate = (
  appointment: Appointment
): { dateLabel: string; timeLabel: string } => {
  if (appointment.appointment_date || appointment.appointment_time) {
    return {
      dateLabel: formatDateShort(appointment.appointment_date),
      timeLabel: appointment.appointment_time || '-',
    };
  }

  const [datePart, timePart] = (appointment.date || '').split(' | ');
  return {
    dateLabel: datePart ? formatDateShort(datePart) : appointment.date || '-',
    timeLabel: timePart || '-',
  };
};

const formatCreatedAt = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;

  return formatDateShort(value);
};

const formatCurrency = (value?: number | null): string => {
  if (!value) return 'Belum ada nota';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
};

export default function AdminActivityDetailScreen() {
  const navigation = useNavigation<any>();
  const [activities, setActivities] = useState<Appointment[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadActivities = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'id, user_id, patient_name, doctor_id, doctor_name, date, appointment_date, appointment_time, symptoms, status, created_at, consultation_fee, completed_at'
        )
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivities((data || []) as Appointment[]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat aktivitas reservasi.');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  useEffect(() => {
    const channel = supabase
      .channel('admin-activity-detail')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => loadActivities({ silent: true })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadActivities]);

  const counts = useMemo(() => {
    const next: Record<AppointmentStatus, number> = {
      pending: 0,
      Confirmed: 0,
      Diproses: 0,
      Cancelled: 0,
      Selesai: 0,
    };

    for (const item of activities) {
      next[item.status] = (next[item.status] || 0) + 1;
    }

    return next;
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (activeFilter === 'all') return activities;
    return activities.filter((item) => item.status === activeFilter);
  }, [activeFilter, activities]);

  const summary = useMemo(() => {
    const active = counts.pending + counts.Confirmed + counts.Diproses;
    const latest = activities[0]?.created_at ? formatRelativeTime(activities[0].created_at) : '-';

    return {
      total: activities.length,
      active,
      pending: counts.pending,
      completed: counts.Selesai,
      latest,
    };
  }, [activities, counts]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities({ silent: true });
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {!!errorMessage && (
        <ErrorState
          message={errorMessage}
          onRetry={() => loadActivities()}
          style={styles.errorBlock}
        />
      )}

      <Card variant="default" padding="lg" style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.summaryEyebrow}>Ringkasan Aktivitas</Text>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summarySub}>reservasi terakhir tercatat</Text>
          </View>
          <IconBadge
            icon="pulse"
            tone="admin"
            size="lg"
            bgColor="rgba(255,255,255,0.16)"
            iconColor={COLORS.surface}
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryMetric label="Aktif" value={summary.active} tone="info" />
          <SummaryMetric label="Menunggu" value={summary.pending} tone="warning" />
          <SummaryMetric label="Selesai" value={summary.completed} tone="success" />
          <SummaryMetric label="Terbaru" value={summary.latest} tone="neutral" compact />
        </View>
      </Card>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Filter Status</Text>
        <Text style={styles.sectionHint}>{filteredActivities.length} data</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter.key;
          const count =
            filter.key === 'all'
              ? activities.length
              : counts[filter.key as AppointmentStatus] || 0;

          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={filter.icon}
                size={15}
                color={selected ? COLORS.textOnPrimary : COLORS.textMuted}
              />
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                {filter.label}
              </Text>
              <View style={[styles.filterCount, selected && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, selected && styles.filterCountTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Daftar Aktivitas</Text>
        <Text style={styles.sectionHint}>Realtime</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Detail Aktivitas"
        subtitle="Pantau reservasi pasien, status antrean, dan dokter terkait."
        variant="back"
        onBack={() => navigation.goBack()}
        rightSlot={
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Refresh aktivitas"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={COLORS.adminPrimary} />
            ) : (
              <Ionicons name="refresh" size={18} color={COLORS.adminPrimary} />
            )}
          </TouchableOpacity>
        }
      />

      {loading ? (
        <LoadingState fullscreen label="Memuat aktivitas reservasi..." />
      ) : (
        <FlatList
          data={filteredActivities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityCard item={item} />}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            !errorMessage ? (
              <EmptyState
                icon="pulse-outline"
                title="Aktivitas belum tersedia"
                description={
                  activeFilter === 'all'
                    ? 'Reservasi baru akan muncul di halaman ini.'
                    : `Belum ada aktivitas dengan status ${filterLabel(activeFilter)}.`
                }
              />
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.adminPrimary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const filterLabel = (filter: FilterKey): string => {
  if (filter === 'all') return 'Semua';
  return STATUS_LABEL[filter];
};

const SummaryMetric = ({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: number | string;
  tone: 'info' | 'warning' | 'success' | 'neutral';
  compact?: boolean;
}) => {
  const colorMap = {
    info: COLORS.infoText,
    warning: COLORS.warningText,
    success: COLORS.successText,
    neutral: COLORS.textSecondary,
  };

  return (
    <View style={styles.summaryMetric}>
      <Text
        style={[styles.summaryMetricValue, compact && styles.summaryMetricCompact]}
        numberOfLines={compact ? 1 : 2}
      >
        {value}
      </Text>
      <Text style={[styles.summaryMetricLabel, { color: colorMap[tone] }]}>{label}</Text>
    </View>
  );
};

const ActivityCard = ({ item }: { item: Appointment }) => {
  const initials = (item.patient_name || '?').trim().charAt(0).toUpperCase() || '?';
  const { dateLabel, timeLabel } = splitAppointmentDate(item);

  return (
    <Card variant="default" padding="md" style={styles.activityCard}>
      <View style={styles.activityHead}>
        <View style={styles.patientIdentity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.patientName} numberOfLines={1}>
              {item.patient_name || 'Pasien Tanpa Nama'}
            </Text>
            <Text style={styles.createdText} numberOfLines={1}>
              Masuk {formatRelativeTime(item.created_at)}
            </Text>
          </View>
        </View>
        <StatusBadge
          kind={statusToKind(item.status)}
          label={STATUS_LABEL[item.status] || item.status}
          showIcon={false}
          showDot
        />
      </View>

      <View style={styles.infoPanel}>
        <InfoLine icon="medkit-outline" label="Dokter" value={item.doctor_name || '-'} />
        <View style={styles.infoDivider} />
        <InfoLine
          icon="calendar-outline"
          label="Jadwal"
          value={`${dateLabel} | ${timeLabel}`}
        />
        <View style={styles.infoDivider} />
        <InfoLine
          icon="document-text-outline"
          label="Keluhan"
          value={item.symptoms || 'Belum ada keluhan'}
          multiline
        />
      </View>

      <View style={styles.activityFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="receipt-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.footerText}>{formatCurrency(item.consultation_fee)}</Text>
        </View>
        <Text style={styles.footerTime}>{formatCreatedAt(item.created_at)}</Text>
      </View>
    </Card>
  );
};

const InfoLine = ({
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
  <View style={styles.infoLine}>
    <Ionicons name={icon} size={16} color={COLORS.adminPrimary} />
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={multiline ? 3 : 1}>
        {value}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.xxl,
    flexGrow: 1,
  },
  listHeader: {
    gap: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  errorBlock: {
    marginBottom: 0,
  },
  summaryCard: {
    backgroundColor: COLORS.brand800,
    borderColor: COLORS.brand700,
    overflow: 'hidden',
    ...SHADOWS.brand,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.lg,
  },
  summaryEyebrow: {
    ...TYPO.overline,
    color: 'rgba(255,255,255,0.78)',
  },
  summaryValue: {
    ...TYPO.display,
    color: COLORS.textOnPrimary,
    fontSize: 42,
    lineHeight: 48,
    marginTop: 2,
  },
  summarySub: {
    ...TYPO.bodySm,
    color: 'rgba(255,255,255,0.88)',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  summaryMetric: {
    width: '48%',
    minHeight: 70,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  summaryMetricValue: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
  },
  summaryMetricCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryMetricLabel: {
    ...TYPO.caption,
    marginTop: 2,
    fontWeight: '700',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
  },
  sectionHint: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  filterScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
  },
  filterChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.adminPrimary,
    borderColor: COLORS.adminPrimary,
  },
  filterText: {
    ...TYPO.labelSm,
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  filterCount: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  filterCountText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontWeight: '800',
  },
  filterCountTextActive: {
    color: COLORS.textOnPrimary,
  },
  activityCard: {
    marginBottom: SPACING.md,
  },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  patientIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.adminPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPO.h3,
    color: COLORS.adminPrimary,
    fontWeight: '800',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  createdText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  infoPanel: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  infoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  infoLabel: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  infoValue: {
    ...TYPO.bodySm,
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.md,
  },
  activityFooter: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  footerItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  footerTime: {
    ...TYPO.caption,
    color: COLORS.textDisabled,
  },
});
