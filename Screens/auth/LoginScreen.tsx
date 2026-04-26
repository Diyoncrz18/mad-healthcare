/**
 * LoginScreen — Portal Pasien (User)
 * Login & registrasi pasien dengan segmented tab control.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPO } from '../constants/theme';
import { validateAuthInput, signIn, signUp } from '../services/authService';
import { AuthShell } from '../components/layouts/AuthShell';
import { BrandLockup, Card, InputField, Button } from '../components/ui';

type Mode = 'login' | 'signup';

export default function LoginScreen({ navigation }: any) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!validateAuthInput(email, password)) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password, 'user');
      } else {
        await signUp(email, password, 'user');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <BrandLockup
        size="md"
        tagline="Portal Pasien"
        caption="Akses layanan kesehatan dengan satu sentuhan."
      />

      <Card variant="default" padding="xl">
        <View style={styles.tabBar}>
          <TabBtn
            label="Masuk"
            active={mode === 'login'}
            onPress={() => setMode('login')}
          />
          <TabBtn
            label="Daftar Baru"
            active={mode === 'signup'}
            onPress={() => setMode('signup')}
          />
        </View>

        <View style={styles.form}>
          <InputField
            label="Alamat Email"
            icon="mail-outline"
            placeholder="anda@email.com"
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
            hint={mode === 'signup' ? 'Minimal 6 karakter, kombinasi huruf & angka.' : undefined}
          />

          <Button
            label={mode === 'login' ? 'Masuk ke Portal' : 'Daftar Sekarang'}
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

const TabBtn = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.tab, active && styles.tabActive]}
    accessibilityRole="tab"
    accessibilityState={{ selected: active }}
  >
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  tabLabel: {
    ...TYPO.label,
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
  },
  form: { gap: SPACING.lg },
  backRow: { alignItems: 'center', paddingVertical: SPACING.sm },
  backText: { ...TYPO.label, color: COLORS.primary },
});
