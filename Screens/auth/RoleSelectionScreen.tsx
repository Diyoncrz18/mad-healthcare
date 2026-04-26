/**
 * RoleSelectionScreen — Pilihan Akses Portal
 * Halaman utama untuk memilih role login (Pasien, Dokter, Admin).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO } from '../constants/theme';
import { AuthShell } from '../components/layouts/AuthShell';
import { BrandLockup, Card, IconBadge } from '../components/ui';

type Role = {
  key: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'doctor' | 'admin';
  route: string;
};

const ROLES: Role[] = [
  {
    key: 'patient',
    title: 'Portal Pasien',
    desc: 'Buat janji temu dan pantau riwayat kesehatan Anda.',
    icon: 'person',
    tone: 'brand',
    route: 'Login',
  },
  {
    key: 'doctor',
    title: 'Portal Dokter',
    desc: 'Kelola antrean pasien dan jadwal praktik harian.',
    icon: 'medkit',
    tone: 'doctor',
    route: 'DoctorLogin',
  },
  {
    key: 'admin',
    title: 'Portal Admin',
    desc: 'Manajemen sistem, staf, dan operasional klinik.',
    icon: 'shield-checkmark',
    tone: 'admin',
    route: 'AdminGate',
  },
];

export default function RoleSelectionScreen({ navigation }: any) {
  return (
    <AuthShell>
      <BrandLockup
        size="md"
        tagline="Portal Kesehatan Terpadu"
        caption="Pilih jalur akses Anda untuk melanjutkan."
      />

      <View style={styles.list}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.key}
            activeOpacity={0.85}
            onPress={() => navigation.navigate(role.route)}
            accessibilityRole="button"
            accessibilityLabel={role.title}
          >
            <Card variant="default" padding="md">
              <View style={styles.row}>
                <IconBadge icon={role.icon} tone={role.tone} size="lg" />
                <View style={styles.text}>
                  <Text style={styles.title}>{role.title}</Text>
                  <Text style={styles.desc}>{role.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.footnote}>
        Dengan masuk, Anda menyetujui kebijakan privasi dan ketentuan layanan CareConnect.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  text: { flex: 1, gap: 2 },
  title: { ...TYPO.h4, color: COLORS.textPrimary },
  desc: { ...TYPO.bodySm, color: COLORS.textMuted },
  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    lineHeight: 18,
  },
});
