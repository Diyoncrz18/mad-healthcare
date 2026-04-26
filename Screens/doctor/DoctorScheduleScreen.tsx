/**
 * DoctorScheduleScreen — Pengaturan Jam Praktik mingguan REAL.
 *
 * Konsep:
 *   - Load jadwal dari `doctor_schedules` (pakai default kalau belum ada).
 *   - Toggle hari aktif/tutup.
 *   - Save ke Supabase via upsert (atomic per-row).
 *   - Order tampilan: Senin → Minggu (intuitif untuk user Indonesia).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import {
  ScreenHeader,
  Card,
  Button,
  InfoBanner,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '../components/ui';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import {
  DoctorSchedule,
  fetchDoctorSchedule,
  saveDoctorSchedule,
  DAY_LABELS_FULL,
  DISPLAY_ORDER,
} from '../services/scheduleService';

type ScheduleRow = {
  day_of_week: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
};

export default function DoctorScheduleScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;

      const { data: doc, error: docErr } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (docErr) throw docErr;
      if (!doc?.id) {
        setErrorMessage(
          'Akun dokter belum terhubung ke profil dokter. Hubungi admin.'
        );
        return;
      }

      setDoctorId(doc.id);
      const list = await fetchDoctorSchedule(doc.id);
      setSchedule(
        list.map((s) => ({
          day_of_week: s.day_of_week,
          is_active: s.is_active,
          start_time: s.start_time,
          end_time: s.end_time,
        }))
      );
      setDirty(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat jadwal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleDay = (dow: number) => {
    setSchedule((prev) =>
      prev.map((s) =>
        s.day_of_week === dow ? { ...s, is_active: !s.is_active } : s
      )
    );
    setDirty(true);
  };

  const handleSave = async () => {
    if (!doctorId) return;
    setSaving(true);
    try {
      await saveDoctorSchedule(doctorId, schedule);
      Alert.alert('Tersimpan', 'Jadwal praktik berhasil diperbarui.', [
        {
          text: 'OK',
          onPress: () => {
            setDirty(false);
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Jam Praktik"
          variant="back"
          onBack={() => navigation.goBack()}
        />
        <LoadingState fullscreen label="Memuat jadwal…" />
      </SafeAreaView>
    );
  }

  // Sort schedule sesuai DISPLAY_ORDER (Senin → Minggu)
  const orderedSchedule = DISPLAY_ORDER.map(
    (dow) => schedule.find((s) => s.day_of_week === dow)
  ).filter(Boolean) as ScheduleRow[];

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Jam Praktik"
        variant="back"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {!!errorMessage && <ErrorState message={errorMessage} onRetry={loadData} />}

          <InfoBanner
            tone="info"
            title="Atur Jadwal Praktik"
            message="Pasien hanya dapat melihat dan membuat reservasi pada hari yang Anda aktifkan."
          />

          <Text style={styles.sectionTitle}>Jadwal Mingguan</Text>

          <Card variant="default" padding="none">
            {orderedSchedule.map((day, idx) => (
              <View key={day.day_of_week}>
                <View style={styles.row}>
                  <View style={styles.left}>
                    <Switch
                      value={day.is_active}
                      onValueChange={() => toggleDay(day.day_of_week)}
                      trackColor={{
                        false: COLORS.border,
                        true: COLORS.primaryLight,
                      }}
                      thumbColor={day.is_active ? COLORS.primary : COLORS.surface}
                    />
                    <Text
                      style={[
                        styles.dayName,
                        day.is_active ? styles.dayActive : styles.dayInactive,
                      ]}
                    >
                      {DAY_LABELS_FULL[day.day_of_week]}
                    </Text>
                  </View>

                  {day.is_active ? (
                    <View style={styles.timeRow}>
                      <View style={styles.timeBox}>
                        <Text style={styles.timeText}>{day.start_time}</Text>
                      </View>
                      <Text style={styles.timeSep}>—</Text>
                      <View style={styles.timeBox}>
                        <Text style={styles.timeText}>{day.end_time}</Text>
                      </View>
                    </View>
                  ) : (
                    <StatusBadge kind="neutral" label="Tutup" showIcon={false} />
                  )}
                </View>
                {idx < orderedSchedule.length - 1 && (
                  <View style={styles.divider} />
                )}
              </View>
            ))}
          </Card>

          <Text style={styles.footnote}>
            Jam buka/tutup default dapat diubah lebih lanjut di pembaruan
            mendatang. Saat ini Anda bisa mengaktifkan atau menonaktifkan hari.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label={saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          onPress={handleSave}
          loading={saving}
          variant="success"
          size="lg"
          icon="save"
          iconPosition="right"
          fullWidth
          disabled={!dirty || saving || !doctorId}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 120 },
  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary, marginTop: SPACING.sm },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    width: 120,
  },
  dayName: { ...TYPO.label, fontSize: 15 },
  dayActive: { color: COLORS.textPrimary },
  dayInactive: { color: COLORS.textMuted },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeBox: {
    backgroundColor: COLORS.backgroundAlt,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  timeText: { ...TYPO.label, color: COLORS.textPrimary },
  timeSep: { ...TYPO.bodySm, color: COLORS.textMuted },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },

  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: SPACING.sm,
    lineHeight: 18,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl + 4,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.lg,
  },
});
