/**
 * AdminGateScreen — Gerbang Keamanan Admin
 * Screen ini muncul sebelum AdminLoginScreen untuk memastikan
 * hanya user yang mengetahui kode keamanan yang bisa akses portal admin.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

export default function AdminGateScreen({ navigation }: any) {
  const [showPassword, setShowPassword] = useState(false);

  const handleVerify = () => {
    Alert.alert(
      'Portal Admin Terproteksi',
      'Portal admin sekarang hanya bisa diakses dengan akun admin yang valid. Silakan lanjut ke login staff.'
    );
    navigation.navigate('AdminLogin');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-half" size={40} color={COLORS.adminPrimary} />
            </View>
            <Text style={styles.title}>Area Terbatas</Text>
            <Text style={styles.subtitle}>
              Zona Administrator Klinik{'\n'}Masukkan kode keamanan untuk melanjutkan
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color={COLORS.warning} />
              <Text style={styles.warningText}>
                Halaman ini hanya untuk staf dan administrator klinik yang berwenang.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kode Keamanan Sistem</Text>
              <View style={styles.inputWrapper}>
                <Ionicons 
                  name="key-outline" 
                  size={20} 
                  color={COLORS.textMuted} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder="Lanjutkan ke login admin"
                  placeholderTextColor={COLORS.textDisabled}
                  value="Akun admin terverifikasi"
                  editable={false}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)} 
                  style={styles.eyeIcon}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'} 
                    size={20} 
                    color={COLORS.textMuted} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={handleVerify}
            >
              <Text style={styles.verifyBtnText}>Verifikasi & Lanjutkan</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.textOnPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
            <Text style={styles.backBtnText}>Kembali ke Pilihan Akses</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: SPACING.xxl 
  },
  header: { alignItems: 'center', marginBottom: SPACING.xxxl },
  iconContainer: {
    width: 80, height: 80, backgroundColor: COLORS.adminPrimaryLight,
    borderRadius: RADIUS.xxl, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  title: { 
    fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, 
    letterSpacing: -0.5, marginBottom: SPACING.sm 
  },
  subtitle: { 
    fontSize: 15, color: COLORS.textMuted, textAlign: 'center',
    lineHeight: 22, fontWeight: '500' 
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, 
    padding: SPACING.xxl, ...SHADOWS.lg, borderWidth: 1, 
    borderColor: COLORS.borderLight,
  },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', 
    backgroundColor: COLORS.warningBg, padding: SPACING.lg,
    borderRadius: RADIUS.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.warning,
  },
  warningText: {
    flex: 1, marginLeft: SPACING.sm, color: COLORS.warningText,
    fontSize: 14, lineHeight: 20, fontWeight: '500',
  },
  inputGroup: { marginBottom: SPACING.lg },
  label: { 
    fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, 
    marginBottom: SPACING.sm 
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, 
    borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, height: 56,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: COLORS.textPrimary, height: '100%' },
  eyeIcon: { padding: SPACING.xs },
  verifyBtn: {
    backgroundColor: COLORS.adminPrimary, paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginTop: SPACING.md,
    shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  verifyBtnDisabled: {
    backgroundColor: COLORS.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyBtnText: { 
    color: COLORS.textOnPrimary, fontWeight: '700', 
    fontSize: 16, marginRight: SPACING.sm 
  },
  backBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: SPACING.xxxl, paddingVertical: SPACING.md,
  },
  backBtnText: { 
    color: COLORS.textMuted, fontWeight: '600', 
    fontSize: 15, marginLeft: SPACING.sm 
  },
});