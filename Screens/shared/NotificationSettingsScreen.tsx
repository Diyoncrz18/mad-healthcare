/**
 * NotificationSettingsScreen — Pengaturan Notifikasi (Shared semua role)
 *
 * Auto-save toggle ke user_metadata.notification_settings.
 * Default: semua aktif kecuali marketing.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import {
  ScreenHeader,
  Card,
  IconBadge,
  LoadingState,
  InfoBanner,
} from '../components/ui';

type NotificationKey =
  | 'pushEnabled'
  | 'appointmentReminders'
  | 'bookingUpdates'
  | 'healthTips'
  | 'newsletter'
  | 'marketing';

type NotificationSettings = Record<NotificationKey, boolean>;

const DEFAULTS: NotificationSettings = {
  pushEnabled: true,
  appointmentReminders: true,
  bookingUpdates: true,
  healthTips: true,
  newsletter: false,
  marketing: false,
};

type SettingItem = {
  key: NotificationKey;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning';
  group: 'master' | 'app' | 'email';
};

const ITEMS: SettingItem[] = [
  // Master
  {
    key: 'pushEnabled',
    label: 'Push Notifications',
    desc: 'Saklar utama untuk semua notifikasi push.',
    icon: 'notifications',
    tone: 'brand',
    group: 'master',
  },

  // App notifications
  {
    key: 'appointmentReminders',
    label: 'Pengingat Janji',
    desc: 'Pemberitahuan 1 hari & 1 jam sebelum janji.',
    icon: 'alarm',
    tone: 'warning',
    group: 'app',
  },
  {
    key: 'bookingUpdates',
    label: 'Status Reservasi',
    desc: 'Konfirmasi, penolakan, atau perubahan jadwal.',
    icon: 'sync',
    tone: 'info',
    group: 'app',
  },
  {
    key: 'healthTips',
    label: 'Tips Kesehatan',
    desc: 'Artikel pendek & pengingat gaya hidup sehat.',
    icon: 'leaf',
    tone: 'success',
    group: 'app',
  },

  // Email
  {
    key: 'newsletter',
    label: 'Newsletter Mingguan',
    desc: 'Ringkasan tips dan berita kesehatan via email.',
    icon: 'mail',
    tone: 'info',
    group: 'email',
  },
  {
    key: 'marketing',
    label: 'Promo & Penawaran',
    desc: 'Diskon, paket layanan, dan penawaran khusus.',
    icon: 'pricetag',
    tone: 'warning',
    group: 'email',
  },
];

const GROUP_TITLES: Record<'master' | 'app' | 'email', string> = {
  master: 'Saklar Utama',
  app: 'Notifikasi Aplikasi',
  email: 'Notifikasi Email',
};

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [savingKey, setSavingKey] = useState<NotificationKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const stored = (user?.user_metadata?.notification_settings as NotificationSettings) || {};
        setSettings({ ...DEFAULTS, ...stored });
      } catch (err) {
        console.error('Load notif settings failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSetting = async (key: NotificationKey, value: boolean) => {
    setSavingKey(key);
    const next = { ...settings, [key]: value };

    // Cascade: kalau master push dimatikan, app notifications jadi non-effective
    setSettings(next);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { notification_settings: next },
      });
      if (error) throw error;
    } catch (err: any) {
      // Revert kalau gagal
      setSettings(settings);
      Alert.alert('Gagal Menyimpan', err.message || 'Tidak dapat menyimpan preferensi.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat preferensi…" />
      </SafeAreaView>
    );
  }

  const grouped = {
    master: ITEMS.filter((i) => i.group === 'master'),
    app: ITEMS.filter((i) => i.group === 'app'),
    email: ITEMS.filter((i) => i.group === 'email'),
  };

  const masterOff = !settings.pushEnabled;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Notifikasi"
        variant="back"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <InfoBanner
            tone="brand"
            icon="notifications-outline"
            title="Auto-Tersimpan"
            message="Perubahan disimpan otomatis ke akun Anda saat di-toggle."
          />

          {(['master', 'app', 'email'] as const).map((group) => (
            <View key={group} style={styles.group}>
              <Text style={styles.groupTitle}>{GROUP_TITLES[group]}</Text>
              <Card variant="default" padding="none">
                {grouped[group].map((item, idx) => {
                  const isLast = idx === grouped[group].length - 1;
                  const isApp = group === 'app';
                  const disabled = isApp && masterOff;

                  return (
                    <View key={item.key}>
                      <View style={[styles.row, disabled && styles.rowDisabled]}>
                        <IconBadge
                          icon={item.icon}
                          tone={disabled ? 'neutral' : item.tone}
                          size="sm"
                        />
                        <View style={styles.rowText}>
                          <Text
                            style={[
                              styles.rowLabel,
                              disabled && styles.rowLabelDisabled,
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text style={styles.rowDesc}>
                            {disabled
                              ? 'Aktifkan saklar utama untuk mengubah.'
                              : item.desc}
                          </Text>
                        </View>
                        <Switch
                          value={settings[item.key]}
                          onValueChange={(v) => updateSetting(item.key, v)}
                          disabled={disabled || savingKey !== null}
                          trackColor={{
                            false: COLORS.border,
                            true: COLORS.primaryLight,
                          }}
                          thumbColor={
                            settings[item.key] ? COLORS.primary : COLORS.surface
                          }
                        />
                      </View>
                      {!isLast && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}

          <Text style={styles.footnote}>
            Anda dapat berhenti berlangganan notifikasi email kapan saja melalui tautan
            di bawah setiap email yang kami kirim.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxxl },
  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  group: { gap: SPACING.sm },
  groupTitle: {
    ...TYPO.overline,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowDisabled: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowLabel: { ...TYPO.label, color: COLORS.textPrimary, fontSize: 15 },
  rowLabelDisabled: { color: COLORS.textMuted },
  rowDesc: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
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
});
