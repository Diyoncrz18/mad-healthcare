/**
 * AdminGateScreen — Gerbang Keamanan Admin
 * Screen interim sebelum AdminLoginScreen, memberi peringatan area terbatas.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SPACING, TYPO } from '../constants/theme';
import { AuthShell } from '../components/layouts/AuthShell';
import { BrandLockup, Card, Button, InfoBanner } from '../components/ui';

export default function AdminGateScreen({ navigation }: any) {
  const handleVerify = () => {
    Alert.alert(
      'Portal Admin Terproteksi',
      'Portal admin sekarang hanya bisa diakses dengan akun admin yang valid. Silakan lanjut ke login staff.'
    );
    navigation.navigate('AdminLogin');
  };

  return (
    <AuthShell>
      <BrandLockup
        size="md"
        tagline="Area Terbatas"
        caption="Zona Administrator Klinik"
      />

      <Card variant="default" padding="xl">
        <InfoBanner
          tone="warning"
          title="Hanya untuk Staf Berwenang"
          message="Halaman ini eksklusif untuk staf dan administrator klinik. Akses tanpa izin akan dicatat dalam log audit sistem."
          icon="warning"
          style={{ marginBottom: SPACING.xl }}
        />

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Verifikasi Akses</Text>
          <Text style={styles.noteBody}>
            Anda akan diarahkan ke halaman login admin. Pastikan Anda memiliki kredensial
            yang sah sebelum melanjutkan.
          </Text>
        </View>

        <Button
          label="Verifikasi & Lanjutkan"
          onPress={handleVerify}
          size="lg"
          icon="arrow-forward"
          fullWidth
        />
      </Card>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
        style={styles.backRow}
      >
        <Text style={styles.backText}>← Kembali ke pilihan akses</Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  note: {
    marginBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  noteTitle: { ...TYPO.label, color: COLORS.textPrimary },
  noteBody: { ...TYPO.bodySm, color: COLORS.textMuted, lineHeight: 20 },
  backRow: { alignItems: 'center', paddingVertical: SPACING.sm },
  backText: { ...TYPO.label, color: COLORS.primary },
});
