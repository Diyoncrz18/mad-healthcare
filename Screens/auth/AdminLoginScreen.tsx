/**
 * AdminLoginScreen — Portal Admin / Staff Klinik
 * Halaman login dan registrasi untuk administrator klinik.
 */
import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { validateAuthInput, signIn, signUp } from '../services/authService';

export default function AdminLoginScreen({ navigation }: any) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    if (!validateAuthInput(email, password)) return;
    setLoading(true);

    if (isLoginMode) {
      await signIn(email, password, 'admin');
    } else {
      await signUp(email, password, 'admin');
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <View style={styles.iconInner}>
                <Ionicons name="shield-checkmark" size={36} color={COLORS.adminPrimary} />
              </View>
            </View>
            <Text style={styles.appName}>Admin Portal</Text>
            <Text style={styles.tagline}>Manajemen Klinik Internal</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tab, isLoginMode && styles.activeTab]} onPress={() => setIsLoginMode(true)}>
                <Text style={[styles.tabText, isLoginMode && styles.activeTabText]}>Login Staff</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, !isLoginMode && styles.activeTab]} onPress={() => setIsLoginMode(false)}>
                <Text style={[styles.tabText, !isLoginMode && styles.activeTabText]}>Daftar Staff</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Staff</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="admin@klinik.com"
                    placeholderTextColor={COLORS.textDisabled}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kode Keamanan</Text>
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

              {!isLoginMode && <Text style={styles.passwordHint}>Password minimal 6 karakter</Text>}

              <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>{isLoginMode ? 'Akses Sistem' : 'Daftar Admin Baru'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Bukan staf?</Text>
            <TouchableOpacity style={styles.switchRoleBtn} onPress={() => navigation.navigate('RoleSelection')}>
              <Ionicons name="arrow-back" size={16} color={COLORS.adminPrimary} style={styles.footerIconBack} />
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
    width: 72, height: 72, backgroundColor: COLORS.adminPrimaryLight,
    borderRadius: RADIUS.xxl, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg, transform: [{ rotate: '45deg' }],
    shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 8 },
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
    flexDirection: 'row', marginBottom: SPACING.xxl, backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.md, padding: SPACING.xs, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center', borderRadius: RADIUS.sm },
  activeTab: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  tabText: { fontWeight: '600', color: COLORS.textDisabled, fontSize: 15 },
  activeTabText: { color: COLORS.adminPrimary, fontWeight: '700' },
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
    backgroundColor: COLORS.adminPrimary, paddingVertical: SPACING.lg, borderRadius: RADIUS.md,
    alignItems: 'center', marginTop: SPACING.sm,
    shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
  footer: { marginTop: SPACING.xxxl, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '500', marginRight: 6 },
  switchRoleBtn: { flexDirection: 'row', alignItems: 'center' },
  switchRoleText: { color: COLORS.adminPrimary, fontWeight: '700', fontSize: 14 },
  footerIconBack: { marginRight: 4, marginTop: 1 },
});
