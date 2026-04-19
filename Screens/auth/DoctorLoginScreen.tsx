/**
 * DoctorLoginScreen — Portal Dokter
 * Halaman login dan registrasi untuk Dokter.
 */
import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { validateAuthInput, signIn } from '../services/authService';

export default function DoctorLoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!validateAuthInput(email, password)) return;
    setLoading(true);

    await signIn(email, password, 'doctor');

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <View style={styles.iconInner}>
                <Ionicons name="medkit" size={36} color={COLORS.doctorPrimary} />
              </View>
            </View>
            <Text style={styles.appName}>Doctor Portal</Text>
            <Text style={styles.tagline}>Manajemen Medis Spesialis</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.doctorPrimary} />
              <Text style={styles.infoText}>Hanya dokter yang telah didaftarkan oleh admin yang dapat mengakses portal ini.</Text>
            </View>
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Dokter</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="dokter@klinik.com"
                    placeholderTextColor={COLORS.textDisabled}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password / Kode Keamanan</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textDisabled}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Akses Portal Medis</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.switchRoleBtn} onPress={() => navigation.navigate('RoleSelection')}>
              <Ionicons name="arrow-back" size={16} color={COLORS.doctorPrimary} style={styles.footerIconBack} />
              <Text style={styles.switchRoleText}>Kembali ke Pilihan Akses</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xxl },
  header: { alignItems: 'center', marginBottom: SPACING.xxxl, marginTop: SPACING.xl },
  iconContainer: {
    width: 72, height: 72, backgroundColor: COLORS.doctorPrimaryLight,
    borderRadius: RADIUS.xxl, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg, transform: [{ rotate: '45deg' }],
    shadowColor: COLORS.doctorPrimary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  iconInner: { transform: [{ rotate: '-45deg' }] },
  appName: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: COLORS.textMuted, marginTop: SPACING.xs, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xxl,
    ...SHADOWS.lg, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  tabContainer: {
    flexDirection: 'row', marginBottom: SPACING.lg, backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.md, padding: SPACING.xs, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.doctorPrimaryLight,
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.lg, gap: SPACING.sm,
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.doctorPrimary, lineHeight: 18 },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: RADIUS.sm },
  activeTab: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  tabText: { fontWeight: '600', color: COLORS.textDisabled, fontSize: 15 },
  activeTabText: { color: COLORS.doctorPrimary, fontWeight: '700' },
  formContainer: { gap: SPACING.lg },
  inputGroup: { gap: SPACING.sm },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, height: '100%' },
  eyeIcon: { padding: SPACING.xs },
  passwordHint: { fontSize: 12, color: COLORS.textDisabled, marginTop: -8 },
  primaryButton: {
    backgroundColor: COLORS.doctorPrimary, paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    alignItems: 'center', marginTop: SPACING.sm,
    shadowColor: COLORS.doctorPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
  footer: { marginTop: SPACING.xxxl, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '500', marginRight: 6 },
  switchRoleBtn: { flexDirection: 'row', alignItems: 'center' },
  switchRoleText: { color: COLORS.doctorPrimary, fontWeight: '700', fontSize: 14 },
  footerIconBack: { marginRight: 4, marginTop: 1 },
});
