/**
 * DoctorProfileScreen — Profil Dokter
 *
 * Konsep:
 *   - Hero card: avatar besar + nama dokter + spesialisasi + status praktik
 *   - Stats strip (3 kolom: total, aktif, selesai)
 *   - Status Praktik toggle (saklar primary, langsung sync ke Supabase)
 *   - Pengaturan Praktik → Notifikasi
 *   - Pengaturan Akun → Edit Profil, Keamanan
 *   - Dukungan & Info → Pusat Bantuan, Tentang Aplikasi
 *   - Logout button bottom
 *
 * Edit profil sekarang navigate ke EditProfileScreen (bukan modal lagi)
 * untuk konsistensi dengan role lain.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser, signOut } from '../services/authService';
import { supabase } from '../../supabase';
import { Doctor } from '../types';
import { RootStackParamList } from '../../App';
import {
  Card,
  Button,
  StatusBadge,
  IconBadge,
  LoadingState,
  ErrorState,
} from '../components/ui';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Stats = { total: number; active: number; selesai: number };

export default function DoctorProfileScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, selesai: 0 });

  const loadProfile = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;
      setEmail(user.email || '');

      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (doctorError) throw doctorError;

      if (!doctorData) {
        setErrorMessage(
          'Akun dokter ini belum terhubung ke profil dokter. Hubungi admin untuk sinkronisasi data.'
        );
        return;
      }

      setDoctor(doctorData as Doctor);
      setIsActive(doctorData.is_active);

      const { data, error } = await supabase
        .from('appointments')
        .select('status')
        .eq('doctor_id', doctorData.id);

      if (error) throw error;

      if (data) {
        setStats({
          total: data.length,
          active: data.filter(
            (d: any) => d.status === 'pending' || d.status === 'Confirmed'
          ).length,
          selesai: data.filter((d: any) => d.status === 'Selesai').length,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat profil dokter.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleToggleStatus = async (val: boolean) => {
    if (!doctor) {
      setIsActive(val);
      return;
    }
    setIsActive(val);
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_active: val })
        .eq('id', doctor.id);
      if (error) throw error;
    } catch (err: any) {
      setIsActive(!val);
      Alert.alert('Gagal', err.message || 'Tidak dapat memperbarui status.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      'Anda yakin ingin keluar dari Portal Dokter?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat profil…" />
      </SafeAreaView>
    );
  }

  const doctorName = doctor?.name || email.split('@')[0] || 'Dokter';
  const specialty = doctor?.specialty || 'Poli Umum';
  const initial = doctorName.charAt(0).toUpperCase();
  const memberSince = doctor?.created_at
    ? String(new Date(doctor.created_at).getFullYear())
    : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>Profil Medis</Text>
          <Text style={styles.titleSub}>
            Kelola akun dan praktik Anda dalam satu tempat.
          </Text>
        </View>

        <View style={styles.body}>
          {!!errorMessage && (
            <ErrorState message={errorMessage} onRetry={loadProfile} />
          )}

          {/* ── Hero Card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.avatarBadge}>
                  <Ionicons name="medkit" size={12} color={COLORS.surface} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName} numberOfLines={1}>
                  Dr. {doctorName}
                </Text>
                <Text style={styles.heroSpecialty} numberOfLines={1}>
                  {specialty}
                </Text>
                <StatusBadge
                  kind={isActive ? 'success' : 'neutral'}
                  label={isActive ? 'Aktif Praktik' : 'Sedang Cuti'}
                  showIcon={false}
                  showDot
                  style={{ marginTop: SPACING.sm, alignSelf: 'flex-start' }}
                />
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.statsRow}>
              <StatCol value={String(stats.total)} label="Total" />
              <View style={styles.statSep} />
              <StatCol value={String(stats.active)} label="Aktif" />
              <View style={styles.statSep} />
              <StatCol value={String(stats.selesai)} label="Selesai" />
            </View>
          </View>

          {/* ── Email & ID Card ── */}
          <Card variant="outline" padding="none">
            <View style={styles.infoRow}>
              <IconBadge icon="mail-outline" tone="info" size="sm" />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {email}
              </Text>
            </View>
            <View style={styles.menuDivider} />
            <View style={styles.infoRow}>
              <IconBadge icon="card-outline" tone="brand" size="sm" />
              <Text style={styles.infoLabel}>ID Medis</Text>
              <Text style={styles.infoValue}>
                {doctor?.id?.substring(0, 8).toUpperCase() || '—'}
              </Text>
            </View>
            <View style={styles.menuDivider} />
            <View style={styles.infoRow}>
              <IconBadge icon="calendar-outline" tone="success" size="sm" />
              <Text style={styles.infoLabel}>Bergabung</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>
          </Card>

          {/* ── Pengaturan Praktik ── */}
          <Text style={styles.groupTitle}>Pengaturan Praktik</Text>
          <Card variant="default" padding="none">
            <View style={styles.menuRow}>
              <IconBadge icon="pulse" tone="brand" size="sm" />
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>Status Praktik</Text>
                <Text style={styles.menuDesc}>
                  {isActive
                    ? 'Pasien dapat membuat reservasi.'
                    : 'Anda tidak terlihat di antrean pasien.'}
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={handleToggleStatus}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={isActive ? COLORS.primary : COLORS.surface}
              />
            </View>
            <View style={styles.menuDivider} />
            <MenuRow
              icon="notifications-outline"
              tone="warning"
              label="Notifikasi Aktivitas"
              desc="Pemberitahuan request pasien baru"
              onPress={() => navigation.navigate('DoctorNotifications')}
            />
          </Card>

          {/* ── Pengaturan Akun ── */}
          <Text style={styles.groupTitle}>Pengaturan Akun</Text>
          <Card variant="default" padding="none">
            <MenuRow
              icon="person-outline"
              tone="info"
              label="Edit Profil"
              desc="Ubah nama, telepon, dan spesialisasi"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <View style={styles.menuDivider} />
            <MenuRow
              icon="settings-outline"
              tone="brand"
              label="Notifikasi Aplikasi"
              desc="Push, email, dan preferensi lainnya"
              onPress={() => navigation.navigate('NotificationSettings')}
            />
          </Card>

          {/* ── Dukungan & Info ── */}
          <Text style={styles.groupTitle}>Dukungan & Info</Text>
          <Card variant="default" padding="none">
            <MenuRow
              icon="help-buoy-outline"
              tone="brand"
              label="Pusat Bantuan"
              desc="FAQ dan kontak tim support"
              onPress={() => navigation.navigate('HelpCenter')}
            />
            <View style={styles.menuDivider} />
            <MenuRow
              icon="information-circle-outline"
              tone="neutral"
              label="Tentang Aplikasi"
              desc="Versi, lisensi, dan info legal"
              trailing="v1.0"
              onPress={() => navigation.navigate('AboutApp')}
            />
          </Card>

          {/* ── Logout ── */}
          <Button
            label="Keluar Portal Dokter"
            onPress={handleLogout}
            variant="danger"
            icon="log-out-outline"
            iconPosition="left"
            size="lg"
            fullWidth
            style={{ marginTop: SPACING.md }}
          />

          <Text style={styles.footnote}>
            CareConnect Doctor Portal v1.0 • Mendukung praktik medis profesional.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════
const StatCol = ({ value, label }: { value: string; label: string }) => (
  <View style={styles.statCol}>
    <Text style={styles.statColValue}>{value}</Text>
    <Text style={styles.statColLabel}>{label}</Text>
  </View>
);

const MenuRow = ({
  icon,
  tone,
  label,
  desc,
  trailing,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning' | 'neutral';
  label: string;
  desc: string;
  trailing?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={styles.menuRow}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <IconBadge icon={icon} tone={tone} size="sm" />
    <View style={styles.menuText}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuDesc}>{desc}</Text>
    </View>
    {trailing ? (
      <Text style={styles.menuTrailing}>{trailing}</Text>
    ) : (
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    )}
  </TouchableOpacity>
);

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: LAYOUT.bottomSafeGap + SPACING.md },

  titleBar: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.md,
    gap: 4,
  },
  titleText: { ...TYPO.h1, color: COLORS.textPrimary },
  titleSub: { ...TYPO.body, color: COLORS.textMuted },

  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // Hero
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.md,
    gap: SPACING.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...TYPO.h1, color: COLORS.primary, fontSize: 26 },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  heroName: { ...TYPO.h2, color: COLORS.textPrimary },
  heroSpecialty: { ...TYPO.bodySm, color: COLORS.primary, marginTop: 2, fontWeight: '600' },

  heroDivider: { height: 1, backgroundColor: COLORS.borderLight },

  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statColValue: { ...TYPO.h2, color: COLORS.textPrimary },
  statColLabel: { ...TYPO.caption, color: COLORS.textMuted },
  statSep: { width: 1, height: 28, backgroundColor: COLORS.borderLight },

  // Info row (email, ID, joined)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  infoLabel: { ...TYPO.bodySm, color: COLORS.textMuted, flex: 1 },
  infoValue: { ...TYPO.label, color: COLORS.textPrimary },

  // Group
  groupTitle: {
    ...TYPO.overline,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    marginLeft: SPACING.sm,
  },

  // Menu
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  menuText: { flex: 1 },
  menuLabel: { ...TYPO.label, color: COLORS.textPrimary, fontSize: 15 },
  menuDesc: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2, lineHeight: 16 },
  menuTrailing: { ...TYPO.caption, color: COLORS.textMuted },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },

  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontStyle: 'italic',
  },
});
