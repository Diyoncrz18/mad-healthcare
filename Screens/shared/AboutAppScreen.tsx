/**
 * AboutAppScreen — Tentang Aplikasi (Shared semua role)
 *
 * Info ringkas tentang aplikasi: brand, deskripsi, dan credit.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SPACING, TYPO } from '../constants/theme';
import {
  ScreenHeader,
  Card,
  BrandMark,
} from '../components/ui';

const APP_INFO = {
  name: 'CareConnect',
  tagline: 'Portal Kesehatan Terpadu',
  version: '1.0.0',
  copyright: '© 2026 CareConnect. Semua hak dilindungi.',
};

export default function AboutAppScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Tentang Aplikasi"
        variant="back"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Hero */}
          <View style={styles.hero}>
            <BrandMark size="lg" variant="light" />
            <Text style={styles.appName}>{APP_INFO.name}</Text>
            <Text style={styles.tagline}>{APP_INFO.tagline}</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>v{APP_INFO.version}</Text>
            </View>
          </View>

          {/* Tentang */}
          <Text style={styles.sectionTitle}>Tentang Kami</Text>
          <Card variant="default" padding="lg">
            <Text style={styles.aboutText}>
              CareConnect adalah portal kesehatan digital yang menghubungkan pasien,
              dokter, dan administrator klinik dalam satu pengalaman terintegrasi.
              Misi kami adalah menyederhanakan akses ke layanan medis tanpa
              mengorbankan privasi dan kualitas perawatan.
            </Text>
          </Card>

          {/* Credit */}
          <View style={styles.creditBlock}>
            <Text style={styles.creditTitle}>Made with care 🌿</Text>
            <Text style={styles.copyright}>{APP_INFO.copyright}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxxl },
  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  appName: { ...TYPO.h1, color: COLORS.textPrimary, marginTop: SPACING.md },
  tagline: { ...TYPO.body, color: COLORS.textMuted },
  versionPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.xs,
  },
  versionText: { ...TYPO.label, color: COLORS.primary, fontWeight: '700' },

  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary, marginTop: SPACING.sm },

  // About
  aboutText: { ...TYPO.body, color: COLORS.textSecondary, lineHeight: 24 },

  // Credit
  creditBlock: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  creditTitle: { ...TYPO.label, color: COLORS.textPrimary },
  copyright: { ...TYPO.caption, color: COLORS.textMuted },
});
