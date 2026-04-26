/**
 * DoctorNotificationDetailScreen — Detail notifikasi REAL dari Supabase.
 *
 * Konsep:
 *   - Fetch notification by ID dari route param.
 *   - Mark as read saat halaman dibuka.
 *   - Jika type='appointment' dan ada related_appointment_id, fetch
 *     appointment terkait untuk action (Konfirmasi / Tolak) langsung.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, TYPO } from '../constants/theme';
import {
  ScreenHeader,
  Card,
  IconBadge,
  Button,
  StatusBadge,
  LoadingState,
  ErrorState,
} from '../components/ui';
import type { Ionicons } from '@expo/vector-icons';
import {
  Notification,
  NotificationType,
  fetchNotificationById,
  markNotificationRead,
  formatRelativeTime,
} from '../services/notificationService';
import { updateAppointmentStatus } from '../services/appointmentService';
import { supabase } from '../../supabase';

type RouteParams = {
  DoctorNotificationDetail: { notificationId: string };
};

const TYPE_META: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; tone: 'info' | 'success' | 'brand' }
> = {
  appointment: { icon: 'calendar',         tone: 'info' },
  success:     { icon: 'checkmark-circle', tone: 'success' },
  system:      { icon: 'notifications',    tone: 'brand' },
};

type RelatedAppt = {
  id: string;
  patient_name: string;
  status: string;
  appointment_date: string | null;
  appointment_time: string | null;
};

export default function DoctorNotificationDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'DoctorNotificationDetail'>>();
  const { notificationId } = route.params;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notif, setNotif] = useState<Notification | null>(null);
  const [relatedAppt, setRelatedAppt] = useState<RelatedAppt | null>(null);
  const [acting, setActing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const data = await fetchNotificationById(notificationId);
      if (!data) {
        setErrorMessage('Notifikasi tidak ditemukan.');
        return;
      }
      setNotif(data);

      // Mark as read on open (fire-and-forget)
      if (!data.is_read) {
        markNotificationRead(data.id).catch(() => {});
      }

      // Fetch related appointment kalau ada
      if (data.related_appointment_id) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id, patient_name, status, appointment_date, appointment_time')
          .eq('id', data.related_appointment_id)
          .maybeSingle();
        if (appt) setRelatedAppt(appt as RelatedAppt);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
    }
  }, [notificationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAppointmentAction = (newStatus: 'Confirmed' | 'Cancelled') => {
    if (!relatedAppt) return;
    const labels = {
      Confirmed: { title: 'Konfirmasi Jadwal', verb: 'mengkonfirmasi' },
      Cancelled: { title: 'Tolak Permintaan', verb: 'menolak' },
    };
    const meta = labels[newStatus];

    Alert.alert(
      meta.title,
      `Apakah Anda yakin ${meta.verb} permintaan dari ${relatedAppt.patient_name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: meta.title,
          style: newStatus === 'Cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            setActing(true);
            try {
              await updateAppointmentStatus(relatedAppt.id, newStatus);
              Alert.alert(
                'Berhasil',
                `Permintaan berhasil ${newStatus === 'Confirmed' ? 'dikonfirmasi' : 'ditolak'}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (err: any) {
              Alert.alert('Gagal', err.message || 'Terjadi kesalahan.');
            } finally {
              setActing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Detail Notifikasi"
          variant="back"
          onBack={() => navigation.goBack()}
        />
        <LoadingState fullscreen label="Memuat detail…" />
      </SafeAreaView>
    );
  }

  if (errorMessage || !notif) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Detail Notifikasi"
          variant="back"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.errorWrap}>
          <ErrorState
            message={errorMessage || 'Notifikasi tidak ditemukan.'}
            onRetry={loadData}
          />
        </View>
      </SafeAreaView>
    );
  }

  const meta = TYPE_META[notif.type] || TYPE_META.system;
  const isPendingAppt = relatedAppt?.status === 'pending';

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Detail Notifikasi"
        variant="back"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="default" padding="lg">
          <View style={styles.head}>
            <IconBadge icon={meta.icon} tone={meta.tone} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{notif.title}</Text>
              <Text style={styles.date}>
                {formatRelativeTime(notif.created_at)}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.contentBox}>
            <Text style={styles.message}>{notif.message}</Text>
          </View>

          {/* Related appointment info */}
          {relatedAppt && (
            <View style={styles.relatedCard}>
              <View style={styles.relatedHead}>
                <Text style={styles.relatedTitle}>Janji Terkait</Text>
                <StatusBadge
                  kind={
                    relatedAppt.status === 'pending'
                      ? 'pending'
                      : relatedAppt.status === 'Confirmed'
                      ? 'confirmed'
                      : relatedAppt.status === 'Selesai'
                      ? 'completed'
                      : 'cancelled'
                  }
                />
              </View>
              <View style={styles.relatedRow}>
                <Text style={styles.metaLabel}>Pasien</Text>
                <Text style={styles.metaValue}>{relatedAppt.patient_name}</Text>
              </View>
              <View style={styles.relatedRow}>
                <Text style={styles.metaLabel}>Tanggal</Text>
                <Text style={styles.metaValue}>
                  {relatedAppt.appointment_date || '—'}
                </Text>
              </View>
              <View style={styles.relatedRow}>
                <Text style={styles.metaLabel}>Jam</Text>
                <Text style={styles.metaValue}>
                  {relatedAppt.appointment_time || '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Actions: hanya kalau pending */}
          {notif.type === 'appointment' && isPendingAppt && (
            <View style={styles.actions}>
              <Button
                label="Konfirmasi Jadwal"
                onPress={() => handleAppointmentAction('Confirmed')}
                variant="success"
                size="lg"
                icon="checkmark-circle"
                iconPosition="right"
                fullWidth
                loading={acting}
                disabled={acting}
              />
              <Button
                label="Tolak Permintaan"
                onPress={() => handleAppointmentAction('Cancelled')}
                variant="outline"
                size="lg"
                fullWidth
                disabled={acting}
                textStyle={{ color: COLORS.danger }}
              />
            </View>
          )}

          {/* Info message kalau status sudah berubah */}
          {notif.type === 'appointment' && relatedAppt && !isPendingAppt && (
            <View style={styles.statusInfo}>
              <Text style={styles.statusInfoText}>
                Permintaan ini sudah ditangani dengan status{' '}
                <Text style={styles.statusInfoBold}>{relatedAppt.status}</Text>.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.xl },
  errorWrap: { padding: SPACING.xl },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  title: { ...TYPO.h3, color: COLORS.textPrimary },
  date: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 4 },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginBottom: SPACING.lg,
  },

  contentBox: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  message: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },

  // Related appointment card
  relatedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  relatedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  relatedTitle: { ...TYPO.label, color: COLORS.textPrimary, fontWeight: '700' },
  relatedRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  metaLabel: { ...TYPO.bodySm, color: COLORS.textMuted, width: 70 },
  metaValue: { ...TYPO.bodySm, color: COLORS.textPrimary, flex: 1 },

  actions: { gap: SPACING.md },

  statusInfo: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: 8,
    padding: SPACING.md,
  },
  statusInfoText: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  statusInfoBold: { fontWeight: '700', color: COLORS.textPrimary },
});
