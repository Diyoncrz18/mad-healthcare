/**
 * HelpCenterScreen — Pusat Bantuan (Shared semua role)
 *
 * Kategori bantuan + FAQ accordion + kontak (telepon, email, WhatsApp).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SPACING, TYPO } from '../constants/theme';
import {
  ScreenHeader,
  Card,
  IconBadge,
} from '../components/ui';

const CONTACT = {
  phone: '08001234567',
  phoneLabel: '0800-1234-567',
  email: 'support@careconnect.id',
  whatsapp: '6281234567890',
  whatsappLabel: '+62 812-3456-7890',
};

type Category = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'info' | 'success' | 'warning';
  title: string;
  desc: string;
};

const CATEGORIES: Category[] = [
  {
    key: 'reservasi',
    icon: 'calendar',
    tone: 'brand',
    title: 'Reservasi',
    desc: 'Buat, ubah, atau batalkan janji.',
  },
  {
    key: 'akun',
    icon: 'person',
    tone: 'info',
    title: 'Akun',
    desc: 'Login, profil, dan keamanan.',
  },
  {
    key: 'pembayaran',
    icon: 'card',
    tone: 'success',
    title: 'Pembayaran',
    desc: 'Tarif, refund, dan struk.',
  },
  {
    key: 'lainnya',
    icon: 'help-circle',
    tone: 'warning',
    title: 'Lainnya',
    desc: 'Pertanyaan umum lainnya.',
  },
];

type Faq = {
  q: string;
  a: string;
};

const FAQS: Faq[] = [
  {
    q: 'Bagaimana cara membuat janji konsultasi?',
    a: 'Buka tab Beranda → Buat Janji. Pilih dokter, tanggal, jam, lalu isi keluhan. Konfirmasi akan dikirim setelah dokter meninjau.',
  },
  {
    q: 'Bisakah saya membatalkan janji?',
    a: 'Bisa. Buka tab Jadwal, pilih janji yang ingin dibatalkan, lalu tap "Batalkan Janji". Pembatalan minimal 2 jam sebelum sesi.',
  },
  {
    q: 'Apakah saya bisa memilih dokter spesialis?',
    a: 'Ya. Saat membuat janji, daftar dokter beserta spesialisasinya akan tersedia untuk dipilih.',
  },
  {
    q: 'Bagaimana cara mengubah email atau password?',
    a: 'Email tidak dapat diubah dari aplikasi karena terkait verifikasi keamanan. Untuk password, silakan hubungi tim support.',
  },
  {
    q: 'Apakah biaya konsultasi sudah termasuk obat?',
    a: 'Belum. Biaya konsultasi mencakup pemeriksaan dan diagnosis. Resep obat dibeli terpisah di apotek pilihan Anda.',
  },
];

export default function HelpCenterScreen() {
  const navigation = useNavigation();
  const [expanded, setExpanded] = useState<number | null>(0);

  const handleContact = async (type: 'phone' | 'email' | 'whatsapp') => {
    let url = '';
    if (type === 'phone') url = `tel:${CONTACT.phone}`;
    if (type === 'email') url = `mailto:${CONTACT.email}`;
    if (type === 'whatsapp') url = `https://wa.me/${CONTACT.whatsapp}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Tidak Tersedia', 'Perangkat ini tidak mendukung tindakan ini.');
    } catch {
      Alert.alert('Gagal', 'Tidak dapat membuka tautan.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Pusat Bantuan"
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
            <Ionicons name="chatbubbles" size={28} color={COLORS.surface} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Ada yang bisa kami bantu?</Text>
              <Text style={styles.heroSub}>
                Cek FAQ atau hubungi tim support kami secara langsung.
              </Text>
            </View>
          </View>

          {/* Kategori */}
          <Text style={styles.sectionTitle}>Kategori Bantuan</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                activeOpacity={0.85}
                style={styles.gridWrap}
                accessibilityRole="button"
                accessibilityLabel={cat.title}
              >
                <Card variant="default" padding="md">
                  <View style={{ gap: SPACING.sm }}>
                    <IconBadge icon={cat.icon} tone={cat.tone} size="md" />
                    <View style={{ gap: 2 }}>
                      <Text style={styles.gridTitle}>{cat.title}</Text>
                      <Text style={styles.gridDesc}>{cat.desc}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>

          {/* FAQ */}
          <Text style={styles.sectionTitle}>Pertanyaan Populer</Text>
          <View style={{ gap: SPACING.sm }}>
            {FAQS.map((faq, idx) => {
              const isOpen = expanded === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => setExpanded(isOpen ? null : idx)}
                  accessibilityRole="button"
                  accessibilityLabel={faq.q}
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Card variant="outline" padding="md">
                    <View style={styles.faqHead}>
                      <Text style={styles.faqQ} numberOfLines={isOpen ? 0 : 2}>
                        {faq.q}
                      </Text>
                      <View style={[styles.faqChevron, isOpen && styles.faqChevronOpen]}>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={COLORS.primary}
                        />
                      </View>
                    </View>
                    {isOpen && (
                      <View style={styles.faqAnswerWrap}>
                        <Text style={styles.faqA}>{faq.a}</Text>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Kontak */}
          <Text style={styles.sectionTitle}>Hubungi Kami</Text>
          <Card variant="default" padding="none">
            <ContactRow
              icon="call"
              tone="brand"
              label="Telepon Klinik 24/7"
              value={CONTACT.phoneLabel}
              onPress={() => handleContact('phone')}
            />
            <View style={styles.divider} />
            <ContactRow
              icon="logo-whatsapp"
              tone="success"
              label="WhatsApp"
              value={CONTACT.whatsappLabel}
              onPress={() => handleContact('whatsapp')}
            />
            <View style={styles.divider} />
            <ContactRow
              icon="mail"
              tone="info"
              label="Email Support"
              value={CONTACT.email}
              onPress={() => handleContact('email')}
            />
          </Card>

          <Text style={styles.footnote}>
            Tim support kami siap membantu Senin–Sabtu, 08:00–20:00 WIB.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ContactRow = ({
  icon,
  tone,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'brand' | 'success' | 'info';
  label: string;
  value: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={styles.contactRow}
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value}`}
  >
    <IconBadge icon={icon} tone={tone} size="sm" />
    <View style={{ flex: 1 }}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxxl },
  body: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
  },
  heroTitle: { ...TYPO.h3, color: COLORS.textOnPrimary },
  heroSub: { ...TYPO.bodySm, color: 'rgba(255,255,255,0.92)', marginTop: 2 },

  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary, marginTop: SPACING.sm },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  gridWrap: { width: '47.5%' },
  gridTitle: { ...TYPO.label, color: COLORS.textPrimary },
  gridDesc: { ...TYPO.caption, color: COLORS.textMuted, lineHeight: 16 },

  // FAQ
  faqHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  faqQ: {
    ...TYPO.label,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  faqChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqChevronOpen: { transform: [{ rotate: '180deg' }] },
  faqAnswerWrap: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  faqA: { ...TYPO.bodySm, color: COLORS.textSecondary, lineHeight: 22 },

  // Contact
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  contactLabel: { ...TYPO.caption, color: COLORS.textMuted },
  contactValue: { ...TYPO.label, color: COLORS.textPrimary, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },

  footnote: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: SPACING.sm,
    lineHeight: 18,
  },
});
