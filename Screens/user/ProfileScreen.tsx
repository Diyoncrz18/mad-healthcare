/**
 * ProfileScreen — Profil Pasien & Admin (Shared)
 *
 * Konsep:
 *   - Hero card: avatar besar + nama + email + role badge
 *   - Stats strip (3 kolom: aktif, selesai, sejak) untuk pasien
 *   - Menu Pengaturan Akun → Edit Profil, Notifikasi, Keamanan
 *   - Menu Dukungan & Info → Pusat Bantuan, Tentang Aplikasi
 *   - Logout button bottom
 *
 * Setiap menu item navigasi ke detail screen yang sesuai.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser, signOut } from '../services/authService';
import { supabase } from '../../supabase';
import { UserRole } from '../types';
import { RootStackParamList } from '../../App';
import {
  Card,
  Button,
  StatusBadge,
  IconBadge,
  LoadingState,
} from '../components/ui';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type PatientStats = {
  totalAppts: number;
  activeAppts: number;
  completedAppts: number;
  memberSince: string;
};

type AdminStats = {
  totalPatients: number;
  totalDoctors: number;
  memberSince: string;
};

const formatYear = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return String(d.getFullYear());
};

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [patientStats, setPatientStats] = useState<PatientStats>({
    totalAppts: 0,
    activeAppts: 0,
    completedAppts: 0,
    memberSince: '—',
  });
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalPatients: 0,
    totalDoctors: 0,
    memberSince: '—',
  });

  const loadProfile = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const userRole = (user.user_metadata?.role || 'user') as UserRole;
      const meta = user.user_metadata || {};
      const displayName =
        (meta.display_name as string) ||
        (meta.name as string) ||
        (user.email || '').split('@')[0];

      setRole(userRole);
      setEmail(user.email || '');
      setName(displayName);

      const since = formatYear(user.created_at);

      if (userRole === 'admin') {
        const [{ count: patients }, { count: doctors }] = await Promise.all([
          supabase
            .from('appointments')
            .select('user_id', { count: 'exact', head: false })
            .limit(1),
          supabase.from('doctors').select('id', { count: 'exact', head: true }),
        ]);

        // patient unique count via raw query since "exact" with distinct nggak supported langsung
        const { data: appData } = await supabase
          .from('appointments')
          .select('user_id');
        const uniquePatients = new Set(
          (appData || []).map((r: any) => r.user_id).filter(Boolean)
        );

        setAdminStats({
          totalPatients: uniquePatients.size,
          totalDoctors: doctors || 0,
          memberSince: since,
        });
      } else {
        // Patient stats
        const { data } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('user_id', user.id);

        const list = data || [];
        const total = list.length;
        const active = list.filter(
          (a: any) => a.status === 'pending' || a.status === 'Confirmed'
        ).length;
        const completed = list.filter((a: any) => a.status === 'Selesai').length;

        setPatientStats({
          totalAppts: total,
          activeAppts: active,
          completedAppts: completed,
          memberSince: since,
        });
      }
    } catch (err) {
      console.error('Load profile failed:', err);
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

  const handleLogout = () => {
    Alert.alert(
      'Konfirmasi Keluar',
      `Anda yakin ingin keluar dari akun ${role === 'admin' ? 'admin' : 'pasien'}?`,
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

  const isAdmin = role === 'admin';
  const initial = (name || email || '?').charAt(0).toUpperCase();
  const roleLabel = isAdmin ? 'Administrator' : 'Pasien Reguler';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <View style={styles.titleBar}>
          <Text style={styles.titleText}>Profil</Text>
          <Text style={styles.titleSub}>
            Kelola akun dan preferensi Anda di sini.
          </Text>
        </View>

        <View style={styles.body}>
          {/* ── Hero Card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.avatarBadge}>
                  <Ionicons
                    name={isAdmin ? 'shield-checkmark' : 'person'}
                    size={12}
                    color={COLORS.surface}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.heroEmail} numberOfLines={1}>
                  {email}
                </Text>
                <StatusBadge
                  kind={isAdmin ? 'success' : 'info'}
                  label={roleLabel}
                  showIcon={false}
                  showDot
                  style={{ marginTop: SPACING.sm, alignSelf: 'flex-start' }}
                />
              </View>
            </View>

            {/* Stats strip */}
            <View style={styles.heroDivider} />
            <View style={styles.statsRow}>
              {isAdmin ? (
                <>
                  <StatCol value={String(adminStats.totalPatients)} label="Pasien" />
                  <View style={styles.statSep} />
                  <StatCol value={String(adminStats.totalDoctors)} label="Dokter" />
                  <View style={styles.statSep} />
                  <StatCol value={adminStats.memberSince} label="Sejak" />
                </>
              ) : (
                <>
                  <StatCol value={String(patientStats.totalAppts)} label="Total" />
                  <View style={styles.statSep} />
                  <StatCol value={String(patientStats.completedAppts)} label="Selesai" />
                  <View style={styles.statSep} />
                  <StatCol value={patientStats.memberSince} label="Sejak" />
                </>
              )}
            </View>
          </View>

          {/* ── Pengaturan Akun ── */}
          <Text style={styles.groupTitle}>Pengaturan Akun</Text>
          <Card variant="default" padding="none">
            <MenuRow
              icon="person-outline"
              tone="info"
              label="Edit Profil"
              desc="Ubah nama, telepon, dan info pribadi"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <MenuDivider />
            <MenuRow
              icon="notifications-outline"
              tone="warning"
              label="Notifikasi"
              desc="Kelola preferensi pemberitahuan"
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
            <MenuDivider />
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
            label="Keluar Akun"
            onPress={handleLogout}
            variant="danger"
            icon="log-out-outline"
            iconPosition="left"
            size="lg"
            fullWidth
            style={{ marginTop: SPACING.md }}
          />

          <Text style={styles.footnote}>
            CareConnect v1.0 • Dibuat untuk kenyamanan kesehatan Anda.
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

const MenuDivider = () => <View style={styles.menuDivider} />;

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
  },

  // Title
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
  heroEmail: { ...TYPO.bodySm, color: COLORS.textMuted, marginTop: 2 },

  // Stats
  heroDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCol: { flex: 1, alignItems: 'center', gap: 2 },
  statColValue: { ...TYPO.h2, color: COLORS.textPrimary },
  statColLabel: { ...TYPO.caption, color: COLORS.textMuted },
  statSep: { width: 1, height: 28, backgroundColor: COLORS.borderLight },

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

  // Footnote
  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontStyle: 'italic',
  },
});
