/**
 * AdminLoginScreen — Portal Admin / Staff Klinik
 * Login untuk akun administrator klinik.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPO } from '../constants/theme';
import { validateAuthInput, signIn } from '../services/authService';
import { AuthShell } from '../components/layouts/AuthShell';
import { BrandLockup, Card, InputField, Button } from '../components/ui';

export default function AdminLoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!validateAuthInput(email, password)) return;
    setLoading(true);
    try {
      await signIn(email, password, 'admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <BrandLockup
        size="md"
        tagline="Portal Admin"
        caption="Manajemen sistem & operasional klinik."
      />

      <Card variant="default" padding="xl">
        <View style={styles.form}>
          <InputField
            label="Email Staf"
            icon="mail-outline"
            placeholder="admin@klinik.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <InputField
            label="Kata Sandi"
            icon="lock-closed-outline"
            placeholder="Masukkan kata sandi"
            value={password}
            onChangeText={setPassword}
            isPassword
          />

          <Button
            label="Akses Sistem"
            onPress={handleAuth}
            loading={loading}
            size="lg"
            icon="arrow-forward"
            fullWidth
          />
        </View>
      </Card>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => navigation.navigate('RoleSelection')}
        style={styles.backRow}
      >
        <Text style={styles.backText}>← Pilih akses lain</Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.lg },
  backRow: { alignItems: 'center', paddingVertical: SPACING.sm },
  backText: { ...TYPO.label, color: COLORS.primary },
});
