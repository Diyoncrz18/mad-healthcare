/**
 * DoctorEarningsScreen — Analitik Pendapatan Dokter
 *
 * Menampilkan ringkasan pendapatan dokter berdasarkan appointment
 * berstatus `Selesai`. Period selector mendukung 7 Hari / 30 Hari /
 * 12 Bulan / Semua. Visualisasi: hero KPI + stats grid + bar chart
 * trend + daftar transaksi terbaru.
 *
 * Catatan tarif:
 *   Schema `appointments` saat ini belum menyimpan harga konsultasi.
 *   Sebagai default kita pakai `CONSULTATION_FEE` (Rp 150.000) sebagai
 *   tarif tetap. Jika nanti ada kolom `price` / `consultation_fee` di
 *   tabel, ganti `feeFor(item)` untuk membaca field tersebut.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import {
  ScreenHeader,
  Card,
  IconBadge,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components/ui';

// ═══════════════════════════════════════════════════════════════════
// Konfigurasi & Helpers
// ═══════════════════════════════════════════════════════════════════
const CONSULTATION_FEE = 150_000; // Rp per konsultasi (default)

const feeFor = (_appt: Appointment): number => CONSULTATION_FEE;

const formatIDR = (value: number): string =>
  'Rp ' + Math.round(value).toLocaleString('id-ID');

const formatIDRShort = (value: number): string => {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)} rb`;
  return `Rp ${value}`;
};

type Appointment = {
  id: string;
  patient_name: string;
  doctor_id: string;
  date: string;
  symptoms: string;
  status: string;
  created_at: string;
  appointment_date?: string | null;
};

type PeriodKey = '7d' | '30d' | '12m' | 'all';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '7d',  label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '12m', label: '12 Bulan' },
  { key: 'all', label: 'Semua' },
];

// ── Date helpers ──────────────────────────────────────────────────
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const addMonths = (d: Date, months: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
};

const dateOfAppointment = (a: Appointment): Date => {
  // Prefer appointment_date kalau ada, fallback ke created_at
  if (a.appointment_date) {
    const dt = new Date(a.appointment_date);
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date(a.created_at);
};

const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// ── Aggregation untuk chart ───────────────────────────────────────
type Bucket = { label: string; value: number; subLabel?: string };

const buildBuckets = (
  period: PeriodKey,
  appts: Appointment[]
): Bucket[] => {
  const today = startOfDay(new Date());

  if (period === '7d') {
    // 7 daily buckets
    const buckets: Bucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = addDays(today, -i);
      const next = addDays(day, 1);
      const sum = appts
        .filter((a) => {
          const d = dateOfAppointment(a);
          return d >= day && d < next;
        })
        .reduce((acc, a) => acc + feeFor(a), 0);
      buckets.push({
        label: DAY_SHORT_ID[day.getDay()],
        subLabel: String(day.getDate()),
        value: sum,
      });
    }
    return buckets;
  }

  if (period === '30d') {
    // 6 buckets x 5 hari (terdekat)
    const buckets: Bucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = addDays(today, -i * 5 - 4);
      const end = addDays(start, 5);
      const sum = appts
        .filter((a) => {
          const d = dateOfAppointment(a);
          return d >= start && d < end;
        })
        .reduce((acc, a) => acc + feeFor(a), 0);
      buckets.push({
        label: `${start.getDate()}–${addDays(end, -1).getDate()}`,
        subLabel: MONTH_SHORT_ID[start.getMonth()],
        value: sum,
      });
    }
    return buckets;
  }

  // '12m' & 'all' → 12 monthly buckets terakhir
  const buckets: Bucket[] = [];
  const startMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  for (let i = 0; i < 12; i++) {
    const m = addMonths(startMonth, i);
    const next = addMonths(m, 1);
    const sum = appts
      .filter((a) => {
        const d = dateOfAppointment(a);
        return d >= m && d < next;
      })
      .reduce((acc, a) => acc + feeFor(a), 0);
    buckets.push({
      label: MONTH_SHORT_ID[m.getMonth()],
      subLabel: String(m.getFullYear()).slice(-2),
      value: sum,
    });
  }
  return buckets;
};

// Filter appts dalam periode tertentu
const filterByPeriod = (period: PeriodKey, appts: Appointment[]): Appointment[] => {
  if (period === 'all') return appts;
  const today = startOfDay(new Date());
  let from: Date;
  if (period === '7d') from = addDays(today, -6);
  else if (period === '30d') from = addDays(today, -29);
  else from = addMonths(today, -11);
  from = startOfDay(from);
  return appts.filter((a) => dateOfAppointment(a) >= from);
};

// Periode sebelumnya (untuk delta %)
const filterPreviousPeriod = (
  period: PeriodKey,
  appts: Appointment[]
): Appointment[] => {
  if (period === 'all') return [];
  const today = startOfDay(new Date());
  let currentFrom: Date;
  let previousFrom: Date;
  let previousTo: Date;
  if (period === '7d') {
    currentFrom = addDays(today, -6);
    previousTo = addDays(currentFrom, 0);
    previousFrom = addDays(previousTo, -7);
  } else if (period === '30d') {
    currentFrom = addDays(today, -29);
    previousTo = addDays(currentFrom, 0);
    previousFrom = addDays(previousTo, -30);
  } else {
    currentFrom = addMonths(today, -11);
    previousTo = addMonths(currentFrom, 0);
    previousFrom = addMonths(previousTo, -12);
  }
  return appts.filter((a) => {
    const d = dateOfAppointment(a);
    return d >= previousFrom && d < previousTo;
  });
};

// ═══════════════════════════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════════════════════════
export default function DoctorEarningsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('30d');

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;

      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('id')
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
        .select('id, patient_name, doctor_id, date, symptoms, status, created_at, appointment_date')
        .eq('doctor_id', doctorData.id)
        .eq('status', 'Selesai')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments((data as Appointment[]) || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data pendapatan.');
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

  // ── Derived metrics ──────────────────────────────────────────────
  const inPeriod = useMemo(
    () => filterByPeriod(period, appointments),
    [period, appointments]
  );
  const inPrevious = useMemo(
    () => filterPreviousPeriod(period, appointments),
    [period, appointments]
  );

  const totalRevenue = useMemo(
    () => inPeriod.reduce((acc, a) => acc + feeFor(a), 0),
    [inPeriod]
  );
  const previousRevenue = useMemo(
    () => inPrevious.reduce((acc, a) => acc + feeFor(a), 0),
    [inPrevious]
  );
  const deltaPercent = useMemo(() => {
    if (previousRevenue === 0) return totalRevenue > 0 ? 100 : 0;
    return ((totalRevenue - previousRevenue) / previousRevenue) * 100;
  }, [totalRevenue, previousRevenue]);

  const consultCount = inPeriod.length;
  const uniquePatients = useMemo(
    () => new Set(inPeriod.map((a) => a.patient_name.trim().toLowerCase())).size,
    [inPeriod]
  );
  const avgPerConsult = consultCount > 0 ? totalRevenue / consultCount : 0;
  const activeDays = useMemo(() => {
    const set = new Set<string>();
    inPeriod.forEach((a) => {
      const d = dateOfAppointment(a);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set.size;
  }, [inPeriod]);

  const buckets = useMemo(
    () => buildBuckets(period, appointments),
    [period, appointments]
  );
  const maxBucket = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.value)),
    [buckets]
  );

  const recentTx = useMemo(() => inPeriod.slice(0, 6), [inPeriod]);

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat analitik pendapatan…" />
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
        <ScreenHeader
          title="Pendapatan"
          subtitle="Analitik konsultasi dan pemasukan praktik Anda."
          rightSlot={
            <IconBadge icon="trending-up" tone="success" size="md" />
          }
        />

        <View style={styles.body}>
          {!!errorMessage && (
            <ErrorState message={errorMessage} onRetry={loadData} />
          )}

          {/* Period Selector */}
          <View style={styles.periodRow}>
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPeriod(p.key)}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      active && styles.periodLabelActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hero KPI */}
          <View style={styles.hero}>
            <View style={styles.heroHead}>
              <Text style={styles.heroEyebrow}>Total Pendapatan</Text>
              <View style={styles.heroBadge}>
                <Ionicons name="cash-outline" size={14} color={COLORS.surface} />
                <Text style={styles.heroBadgeText}>Bersih</Text>
              </View>
            </View>

            <Text style={styles.heroAmount}>{formatIDR(totalRevenue)}</Text>

            {period !== 'all' && (
              <View style={styles.deltaRow}>
                <View
                  style={[
                    styles.deltaPill,
                    {
                      backgroundColor:
                        deltaPercent >= 0
                          ? 'rgba(255,255,255,0.18)'
                          : 'rgba(255,255,255,0.10)',
                    },
                  ]}
                >
                  <Ionicons
                    name={deltaPercent >= 0 ? 'arrow-up' : 'arrow-down'}
                    size={12}
                    color={COLORS.surface}
                  />
                  <Text style={styles.deltaText}>
                    {Math.abs(deltaPercent).toFixed(1)}%
                  </Text>
                </View>
                <Text style={styles.deltaHint}>
                  vs periode sebelumnya ({formatIDRShort(previousRevenue)})
                </Text>
              </View>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatTile
              icon="checkmark-done"
              tone="success"
              value={String(consultCount)}
              label="Konsultasi"
            />
            <StatTile
              icon="people"
              tone="info"
              value={String(uniquePatients)}
              label="Pasien Unik"
            />
            <StatTile
              icon="calculator"
              tone="brand"
              value={formatIDRShort(avgPerConsult)}
              label="Rata-rata"
            />
            <StatTile
              icon="calendar"
              tone="warning"
              value={String(activeDays)}
              label="Hari Aktif"
            />
          </View>

          {/* Trend Chart */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Tren Pendapatan</Text>
            <Text style={styles.sectionHint}>{labelForPeriod(period)}</Text>
          </View>

          <Card variant="default" padding="lg">
            {totalRevenue === 0 ? (
              <View style={styles.chartEmpty}>
                <Ionicons name="bar-chart-outline" size={32} color={COLORS.textDisabled} />
                <Text style={styles.chartEmptyText}>
                  Belum ada pendapatan pada periode ini.
                </Text>
              </View>
            ) : (
              <BarChart buckets={buckets} max={maxBucket} />
            )}
          </Card>

          {/* Recent Transactions */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
            {recentTx.length > 0 && (
              <StatusBadge
                kind="success"
                label={`${recentTx.length} entri`}
                showIcon={false}
                showDot
              />
            )}
          </View>

          {recentTx.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="Belum ada transaksi"
              description="Konsultasi yang telah ditandai selesai akan muncul di sini."
            />
          ) : (
            recentTx.map((item) => (
              <Card
                key={item.id}
                variant="outline"
                padding="md"
                style={{ marginBottom: SPACING.sm }}
              >
                <View style={styles.txRow}>
                  <View style={styles.txAvatar}>
                    <Text style={styles.txInitials}>
                      {item.patient_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txName} numberOfLines={1}>
                      {item.patient_name}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {formatTxDate(dateOfAppointment(item))} • Konsultasi
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>+{formatIDR(feeFor(item))}</Text>
                </View>
              </Card>
            ))
          )}

          <Text style={styles.footnote}>
            * Tarif konsultasi default {formatIDR(CONSULTATION_FEE)} per sesi. Hubungi admin
            untuk menyesuaikan tarif sesuai paket Anda.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════
const StatTile = ({
  icon,
  tone,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'success' | 'info' | 'brand' | 'warning';
  value: string;
  label: string;
}) => (
  <View style={styles.statWrap}>
    <Card variant="default" padding="md">
      <View style={{ gap: SPACING.sm }}>
        <IconBadge icon={icon} tone={tone} size="md" />
        <View style={{ gap: 2 }}>
          <Text style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      </View>
    </Card>
  </View>
);

const BarChart = ({
  buckets,
  max,
}: {
  buckets: Bucket[];
  max: number;
}) => (
  <View style={{ gap: SPACING.md }}>
    <View style={styles.chartArea}>
      {buckets.map((b, idx) => {
        const heightPct = max === 0 ? 0 : (b.value / max) * 100;
        const isActive = b.value > 0;
        return (
          <View key={`${b.label}-${idx}`} style={styles.barColumn}>
            <View style={styles.barTrack}>
              {isActive && (
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max(heightPct, 4)}%` },
                  ]}
                />
              )}
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>
              {b.label}
            </Text>
            {!!b.subLabel && (
              <Text style={styles.barSub} numberOfLines={1}>
                {b.subLabel}
              </Text>
            )}
          </View>
        );
      })}
    </View>
    <View style={styles.chartLegend}>
      <View style={styles.legendDot} />
      <Text style={styles.legendText}>
        Pendapatan per periode • Maks {formatIDRShort(max)}
      </Text>
    </View>
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// Helpers UI
// ═══════════════════════════════════════════════════════════════════
const labelForPeriod = (p: PeriodKey): string => {
  if (p === '7d') return 'Harian (7 hari terakhir)';
  if (p === '30d') return 'Per 5 hari (30 hari terakhir)';
  if (p === '12m') return 'Bulanan (12 bulan terakhir)';
  return 'Bulanan (12 bulan terakhir)';
};

const formatTxDate = (d: Date): string => {
  const day = d.getDate();
  const month = MONTH_SHORT_ID[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
  },

  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // Period chips
  periodRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundAlt,
    padding: 4,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  periodChipActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  periodLabel: { ...TYPO.labelSm, color: COLORS.textMuted },
  periodLabelActive: { color: COLORS.primary },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    gap: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.brand,
  },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroEyebrow: { ...TYPO.overline, color: 'rgba(255,255,255,0.85)' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.pill,
  },
  heroBadgeText: { ...TYPO.caption, color: COLORS.surface, fontWeight: '700' },
  heroAmount: {
    ...TYPO.display,
    color: COLORS.textOnPrimary,
    fontSize: 34,
    lineHeight: 40,
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  deltaText: { ...TYPO.caption, color: COLORS.surface, fontWeight: '700' },
  deltaHint: {
    ...TYPO.caption,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statWrap: { width: '47.5%' },
  statValue: { ...TYPO.h2, color: COLORS.textPrimary },
  statLabel: { ...TYPO.caption, color: COLORS.textMuted },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary },
  sectionHint: { ...TYPO.caption, color: COLORS.textMuted },

  // Bar chart
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
  },
  barLabel: { ...TYPO.caption, color: COLORS.textSecondary, fontWeight: '600' },
  barSub: { ...TYPO.caption, color: COLORS.textMuted, fontSize: 10 },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  legendText: { ...TYPO.caption, color: COLORS.textMuted },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  chartEmptyText: { ...TYPO.bodySm, color: COLORS.textMuted },

  // Transaction
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  txAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInitials: { ...TYPO.h4, color: COLORS.primary },
  txName: { ...TYPO.label, color: COLORS.textPrimary, fontSize: 15 },
  txMeta: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },
  txAmount: { ...TYPO.label, color: COLORS.success, fontSize: 15 },

  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
});
