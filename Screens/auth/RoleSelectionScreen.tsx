/**
 * RoleSelectionScreen — Pilihan Akses Portal
 * Halaman utama untuk memilih role login (Pasien, Dokter, Admin).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

export default function RoleSelectionScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={styles.iconInner}>
              <Ionicons name="medical" size={36} color={COLORS.userPrimary} />
            </View>
          </View>
          <Text style={styles.appName}>CareConnect</Text>
          <Text style={styles.tagline}>Selamat Datang di Portal Kesehatan Terpadu</Text>
          <Text style={styles.subTagline}>Silakan pilih akses masuk Anda</Text>
        </View>

        <View style={styles.roleContainer}>
          {/* Patient Role */}
          <TouchableOpacity 
            style={[styles.roleCard, { borderColor: COLORS.userPrimaryLight }]} 
            onPress={() => navigation.navigate('Login')}
          >
            <View style={[styles.roleIcon, { backgroundColor: COLORS.userPrimaryLight }]}>
              <Ionicons name="person" size={28} color={COLORS.userPrimary} />
            </View>
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>Portal Pasien</Text>
              <Text style={styles.roleDesc}>Buat janji temu dan pantau kesehatan</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
          </TouchableOpacity>

          {/* Doctor Role */}
          <TouchableOpacity 
            style={[styles.roleCard, { borderColor: COLORS.doctorPrimaryLight }]} 
            onPress={() => navigation.navigate('DoctorLogin')}
          >
            <View style={[styles.roleIcon, { backgroundColor: COLORS.doctorPrimaryLight }]}>
              <Ionicons name="medkit" size={28} color={COLORS.doctorPrimary} />
            </View>
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>Portal Dokter</Text>
              <Text style={styles.roleDesc}>Manajemen pasien dan jadwal praktik</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
          </TouchableOpacity>

          {/* Admin Role */}
          <TouchableOpacity 
            style={[styles.roleCard, { borderColor: COLORS.adminPrimaryLight }]} 
            onPress={() => navigation.navigate('AdminGate')}
          >
            <View style={[styles.roleIcon, { backgroundColor: COLORS.adminPrimaryLight }]}>
              <Ionicons name="shield-checkmark" size={28} color={COLORS.adminPrimary} />
            </View>
            <View style={styles.roleTextContainer}>
              <Text style={styles.roleTitle}>Portal Admin</Text>
              <Text style={styles.roleDesc}>Manajemen sistem & staf klinik</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xxxl, marginTop: SPACING.xl },
  iconContainer: {
    width: 72, height: 72, backgroundColor: COLORS.userPrimaryLight,
    borderRadius: RADIUS.xxl, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg, transform: [{ rotate: '45deg' }],
    shadowColor: COLORS.userPrimary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  iconInner: { transform: [{ rotate: '-45deg' }] },
  appName: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: COLORS.textSecondary, marginTop: SPACING.sm, fontWeight: '600', textAlign: 'center' },
  subTagline: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.xs, fontWeight: '400', textAlign: 'center' },
  
  roleContainer: { gap: SPACING.lg },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    padding: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1,
    ...SHADOWS.sm,
  },
  roleIcon: {
    width: 56, height: 56, borderRadius: RADIUS.lg,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.lg,
  },
  roleTextContainer: { flex: 1 },
  roleTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  roleDesc: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
});
