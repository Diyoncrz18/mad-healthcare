import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { onPatientCalled, PatientCalledPayload } from '../services/socketService';

const CALL_TITLE = 'Panggilan Dokter';
const VIBRATION_PATTERN = [0, 900, 300, 900, 300, 1200];
const CALL_SOUND = require('../../assets/patient-call.wav');

const vibratePhone = () => {
  if (Platform.OS === 'web') return;
  Vibration.vibrate(VIBRATION_PATTERN, false);
};

export default function PatientCallListener() {
  const seenIds = useRef<Set<string>>(new Set());
  const [activeCall, setActiveCall] = useState<PatientCalledPayload | null>(null);
  const callPlayer = useAudioPlayer(CALL_SOUND, {
    downloadFirst: true,
    updateInterval: 1000,
  });

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const playCallSound = () => {
      if (Platform.OS === 'web') return;
      try {
        callPlayer.volume = 1;
        callPlayer.seekTo(0);
        callPlayer.play();
      } catch {
        /* suara panggilan non-kritis; getar tetap berjalan */
      }
    };

    const showCall = (payload: PatientCalledPayload) => {
      const key =
        payload.notificationId ||
        `${payload.appointmentId}:${payload.createdAt || payload.message}`;
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);

      playCallSound();
      vibratePhone();
      setActiveCall(payload);
    };

    const unsubscribeSocket = onPatientCalled(showCall);
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    getCurrentUser().then((user) => {
      if (!active || !user) return;
      channel = supabase
        .channel(`patient-calls:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (row?.title !== CALL_TITLE) return;
            showCall({
              appointmentId: row.related_appointment_id || row.id,
              notificationId: row.id,
              patientId: row.recipient_id,
              patientName: 'Pasien',
              doctorName: 'Dokter',
              title: row.title,
              message: row.message,
              createdAt: row.created_at,
            });
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      unsubscribeSocket();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [callPlayer]);

  const title = activeCall?.title || CALL_TITLE;
  const doctorName = activeCall?.doctorName || 'Dokter';
  const message =
    activeCall?.message ||
    'Dokter memanggil Anda. Silakan masuk ke ruangan konsultasi.';

  return (
    <Modal
      visible={!!activeCall}
      transparent
      animationType="fade"
      onRequestClose={() => setActiveCall(null)}
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <Ionicons name="volume-high" size={26} color={COLORS.textOnPrimary} />
              </View>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Panggilan Ruangan</Text>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          <View style={styles.doctorStrip}>
            <View style={styles.doctorIcon}>
              <Ionicons name="medkit" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.doctorInfo}>
              <Text style={styles.doctorLabel}>Dokter Pemeriksa</Text>
              <Text style={styles.doctorName} numberOfLines={1}>
                {doctorName}
              </Text>
            </View>
          </View>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.signalRow}>
            <View style={styles.signalPill}>
              <Ionicons name="musical-notes" size={13} color={COLORS.primary} />
              <Text style={styles.signalText}>Suara aktif</Text>
            </View>
            <View style={styles.signalPill}>
              <Ionicons name="phone-portrait" size={13} color={COLORS.primary} />
              <Text style={styles.signalText}>Getar aktif</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.primaryButton}
            onPress={() => setActiveCall(null)}
            accessibilityRole="button"
            accessibilityLabel="Saya menuju ruangan"
          >
            <Text style={styles.primaryButtonText}>Masuk Ruangan</Text>
            <Ionicons name="arrow-forward" size={17} color={COLORS.textOnPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.secondaryButton}
            onPress={() => setActiveCall(null)}
            accessibilityRole="button"
            accessibilityLabel="Tutup panggilan dokter"
          >
            <Text style={styles.secondaryButtonText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.overlay,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  iconRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.brand100,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    ...TYPO.overline,
    color: COLORS.primary,
  },
  title: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
    marginTop: 3,
  },
  doctorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.brand100,
    marginBottom: SPACING.lg,
  },
  doctorIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorLabel: {
    ...TYPO.caption,
    color: COLORS.textMuted,
  },
  doctorName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  message: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    lineHeight: 23,
    marginBottom: SPACING.lg,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signalText: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    ...SHADOWS.brand,
  },
  primaryButtonText: {
    ...TYPO.label,
    color: COLORS.textOnPrimary,
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  secondaryButtonText: {
    ...TYPO.labelSm,
    color: COLORS.textMuted,
  },
});
