import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { getCurrentUser, signOut } from '../services/authService';
import { UserRole } from '../types';

export default function ProfileScreen() {
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setEmail(user.email || '');
          setRole((user.user_metadata?.role || 'user') as UserRole);
        }
      } catch (error) {
        console.error('Error fetching user', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const isUser = role === 'user';
  const themeColor = isUser ? COLORS.userPrimary : COLORS.adminPrimary;
  const themeLightColor = isUser ? COLORS.userPrimaryLight : COLORS.adminPrimaryLight;
  const roleName = isUser ? 'Pasien Reguler' : 'Administrator';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.userPrimary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Profile */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: themeColor }]}>
            <Ionicons name={isUser ? "person" : "shield-checkmark"} size={48} color={COLORS.surface} />
          </View>
          <Text style={styles.name}>{email ? email.split('@')[0] : 'Pengguna'}</Text>
          <Text style={styles.email}>{email}</Text>
          <View style={[styles.badge, { backgroundColor: themeLightColor }]}>
            <View style={[styles.dot, { backgroundColor: themeColor }]} />
            <Text style={[styles.badgeText, { color: themeColor }]}>{roleName}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuGroup}>
          <Text style={styles.groupTitle}>Pengaturan Akun</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.infoBg }]}>
              <Ionicons name="person-outline" size={20} color={COLORS.info} />
            </View>
            <Text style={styles.menuText}>Edit Informasi Pribadi</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.warningBg }]}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.menuText}>Notifikasi</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.successBg }]}>
              <Ionicons name="shield-outline" size={20} color={COLORS.success} />
            </View>
            <Text style={styles.menuText}>Keamanan & Privasi</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuGroup}>
          <Text style={styles.groupTitle}>Dukungan</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.accentLight }]}>
              <Ionicons name="help-buoy-outline" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.menuText}>Pusat Bantuan</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.menuIcon, { backgroundColor: COLORS.borderLight }]}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.menuText}>Tentang Aplikasi</Text>
            <Text style={styles.versionText}>v1.0</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { padding: SPACING.xl, paddingTop: SPACING.xxxl, paddingBottom: 100 },
  profileHeader: { alignItems: 'center', marginBottom: SPACING.xxxl },
  avatarLarge: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg, ...SHADOWS.md,
  },
  name: { fontSize: 24, ...FONTS.heading, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  email: { fontSize: 15, ...FONTS.body, color: COLORS.textMuted, marginBottom: SPACING.md },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: SPACING.xs },
  badgeText: { fontSize: 13, ...FONTS.label },
  groupTitle: { fontSize: 15, ...FONTS.label, color: COLORS.textMuted, marginBottom: SPACING.md, paddingHorizontal: SPACING.xs },
  menuGroup: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md,
    ...SHADOWS.sm, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.xxl,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  menuIcon: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.lg },
  menuText: { flex: 1, fontSize: 16, ...FONTS.body, color: COLORS.textPrimary },
  versionText: { fontSize: 13, color: COLORS.textDisabled, marginRight: SPACING.sm },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerLight, paddingVertical: SPACING.lg, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.dangerBg, marginTop: SPACING.sm,
  },
  logoutText: { fontSize: 16, ...FONTS.label, color: COLORS.danger, marginLeft: SPACING.sm },
});
