import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import {
  CLINIC_SPECIALTIES,
  ClinicSpecialty,
} from '../constants/clinicSpecialties';
import { Doctor } from '../types';
import { getCurrentUser } from '../services/authService';
import { fetchActiveDoctors } from '../services/doctorService';
import { getOrCreateConversation } from '../services/chatService';
import { Button, Card, IconBadge, ScreenHeader } from '../components/ui';

const normalizeSpecialty = (value = '') =>
  value
    .toLowerCase()
    .replace(/\bdokter\b/g, '')
    .replace(/\bspesialis\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const specialtyAliases = (specialty: ClinicSpecialty) =>
  [specialty.key, specialty.name, specialty.title]
    .map(normalizeSpecialty)
    .filter(Boolean);

const matchesSpecialty = (doctor: Doctor, specialty: ClinicSpecialty) => {
  const doctorSpecialty = normalizeSpecialty(doctor.specialty);
  if (!doctorSpecialty) return false;

  const aliases = specialtyAliases(specialty);
  if (
    aliases.some(
      (alias) =>
        doctorSpecialty === alias ||
        doctorSpecialty.includes(alias) ||
        alias.includes(doctorSpecialty)
    )
  ) {
    return true;
  }

  const doctorTokens = doctorSpecialty
    .split(' ')
    .filter((token) => token && token !== 'dan');

  return doctorTokens.some((token) =>
    aliases.some((alias) => alias.split(' ').includes(token))
  );
};

export default function ClinicSpecialtiesScreen({ navigation, route }: any) {
  const selectedKey = route?.params?.specialtyKey as string | undefined;
  const selectedSpecialty = CLINIC_SPECIALTIES.find((item) => item.key === selectedKey);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [fetchingDoctors, setFetchingDoctors] = useState(true);
  const [expandedSpecialtyKey, setExpandedSpecialtyKey] = useState(selectedKey || '');
  const [startingDoctorId, setStartingDoctorId] = useState('');

  const specialties = useMemo(() => {
    if (!selectedSpecialty) return CLINIC_SPECIALTIES;
    return [
      selectedSpecialty,
      ...CLINIC_SPECIALTIES.filter((item) => item.key !== selectedSpecialty.key),
    ];
  }, [selectedSpecialty]);

  const doctorsBySpecialty = useMemo(() => {
    return CLINIC_SPECIALTIES.reduce<Record<string, Doctor[]>>((result, specialty) => {
      result[specialty.key] = doctors.filter((doctor) =>
        matchesSpecialty(doctor, specialty)
      );
      return result;
    }, {});
  }, [doctors]);

  useEffect(() => {
    if (selectedKey) setExpandedSpecialtyKey(selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    let mounted = true;
    const loadDoctors = async () => {
      try {
        setFetchingDoctors(true);
        const rows = await fetchActiveDoctors();
        if (mounted) setDoctors(rows);
      } catch (err: any) {
        Alert.alert(
          'Gagal Memuat Dokter',
          err?.message || 'Daftar dokter belum bisa dimuat.'
        );
      } finally {
        if (mounted) setFetchingDoctors(false);
      }
    };

    loadDoctors();
    return () => {
      mounted = false;
    };
  }, []);

  const handleBookDoctor = (doctor: Doctor, specialty: ClinicSpecialty) => {
    navigation.navigate('BookAppointment', {
      doctorId: doctor.id,
      specialtyKey: specialty.key,
    });
  };

  const handleConsultDoctor = async (doctor: Doctor) => {
    if (!doctor.user_id) {
      Alert.alert(
        'Konsultasi Belum Tersedia',
        'Akun chat dokter ini belum terhubung. Silakan pilih reservasi terlebih dahulu.'
      );
      return;
    }

    try {
      setStartingDoctorId(doctor.id);
      const user = await getCurrentUser();
      if (!user) {
        Alert.alert('Sesi Berakhir', 'Silakan login ulang untuk memulai konsultasi.');
        return;
      }

      const conversation = await getOrCreateConversation(user.id, doctor.id);
      navigation.navigate('ChatDetail', {
        conversationId: conversation.id,
        title: doctor.name,
        contactRole: 'doctor',
        contactUserId: doctor.user_id,
      });
    } catch (err: any) {
      Alert.alert(
        'Gagal Membuka Konsultasi',
        err?.message || 'Silakan coba lagi.'
      );
    } finally {
      setStartingDoctorId('');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        variant="back"
        title="Spesialis Klinik"
        subtitle={
          selectedSpecialty
            ? `${selectedSpecialty.title} dan layanan spesialis lain yang tersedia di klinik.`
            : 'Pilih layanan spesialis sesuai keluhan dan kebutuhan pemeriksaan Anda.'
        }
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Card variant="accent" accentColor={COLORS.primary} padding="lg">
          <View style={styles.heroRow}>
            <IconBadge icon="business" tone="brand" size="lg" />
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Layanan Klinik Terpadu</Text>
              <Text style={styles.heroDesc}>
                Temukan spesialis yang tepat sebelum membuat janji konsultasi.
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <MetaPill icon="medical" label={`${CLINIC_SPECIALTIES.length} spesialis`} />
            <MetaPill icon="calendar" label="Reservasi online" />
          </View>

          <Button
            label="Buat Janji"
            icon="calendar"
            iconPosition="left"
            onPress={() => navigation.navigate('BookAppointment')}
            fullWidth
            style={styles.heroCta}
          />
        </Card>

        <View style={styles.list}>
          {specialties.map((specialty) => (
            <SpecialtyDetailCard
              key={specialty.key}
              specialty={specialty}
              highlighted={specialty.key === selectedKey}
              doctors={doctorsBySpecialty[specialty.key] || []}
              doctorsLoading={fetchingDoctors}
              doctorListVisible={expandedSpecialtyKey === specialty.key}
              startingDoctorId={startingDoctorId}
              onToggleDoctors={() =>
                setExpandedSpecialtyKey((current) =>
                  current === specialty.key ? '' : specialty.key
                )
              }
              onBookDoctor={(doctor) => handleBookDoctor(doctor, specialty)}
              onConsultDoctor={handleConsultDoctor}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MetaPill = ({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) => (
  <View style={styles.metaPill}>
    <Ionicons name={icon} size={15} color={COLORS.primary} />
    <Text style={styles.metaPillText} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const SpecialtyDetailCard = ({
  specialty,
  highlighted,
  doctors,
  doctorsLoading,
  doctorListVisible,
  startingDoctorId,
  onToggleDoctors,
  onBookDoctor,
  onConsultDoctor,
}: {
  specialty: ClinicSpecialty;
  highlighted: boolean;
  doctors: Doctor[];
  doctorsLoading: boolean;
  doctorListVisible: boolean;
  startingDoctorId: string;
  onToggleDoctors: () => void;
  onBookDoctor: (doctor: Doctor) => void;
  onConsultDoctor: (doctor: Doctor) => void;
}) => (
  <Card
    variant={highlighted ? 'accent' : 'default'}
    accentColor={COLORS.primary}
    padding="lg"
    style={highlighted && styles.highlightCard}
  >
    <View style={styles.cardHeader}>
      <IconBadge icon={specialty.icon} tone={specialty.tone} size="lg" />
      <View style={styles.cardTitleWrap}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {specialty.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          Estimasi konsultasi {specialty.duration}
        </Text>
      </View>
    </View>

    <Text style={styles.summaryText}>{specialty.summary}</Text>

    <View style={styles.detailGrid}>
      <DetailBlock
        icon="clipboard-outline"
        title="Layanan"
        items={specialty.services}
      />
      <DetailBlock
        icon="pulse-outline"
        title="Keluhan umum"
        items={specialty.whenToVisit}
      />
    </View>

    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggleDoctors}
      style={styles.bookLink}
      accessibilityRole="button"
      accessibilityLabel={`Pilih dokter ${specialty.title}`}
    >
      <Text style={styles.bookLinkText}>Pilih Dokter</Text>
      <Ionicons
        name={doctorListVisible ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={COLORS.primary}
      />
    </TouchableOpacity>

    {doctorListVisible && (
      <DoctorOptionsPanel
        specialty={specialty}
        doctors={doctors}
        loading={doctorsLoading}
        startingDoctorId={startingDoctorId}
        onBookDoctor={onBookDoctor}
        onConsultDoctor={onConsultDoctor}
      />
    )}
  </Card>
);

const DoctorOptionsPanel = ({
  specialty,
  doctors,
  loading,
  startingDoctorId,
  onBookDoctor,
  onConsultDoctor,
}: {
  specialty: ClinicSpecialty;
  doctors: Doctor[];
  loading: boolean;
  startingDoctorId: string;
  onBookDoctor: (doctor: Doctor) => void;
  onConsultDoctor: (doctor: Doctor) => void;
}) => (
  <View style={styles.doctorPanel}>
    <View style={styles.doctorPanelHeader}>
      <Text style={styles.doctorPanelTitle}>Pilihan {specialty.title}</Text>
      {!loading && (
        <Text style={styles.doctorPanelMeta}>{doctors.length} dokter aktif</Text>
      )}
    </View>

    {loading ? (
      <View style={styles.doctorLoading}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.doctorLoadingText}>Memuat pilihan dokter...</Text>
      </View>
    ) : doctors.length === 0 ? (
      <View style={styles.doctorEmpty}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.textMuted} />
        <Text style={styles.doctorEmptyText}>
          Belum ada dokter aktif untuk spesialis ini.
        </Text>
      </View>
    ) : (
      <View style={styles.doctorList}>
        {doctors.map((doctor) => (
          <View key={doctor.id} style={styles.doctorOptionCard}>
            <View style={styles.doctorOptionHeader}>
              <View style={styles.doctorAvatarSmall}>
                <Ionicons name="person" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.doctorOptionText}>
                <Text style={styles.doctorOptionName} numberOfLines={1}>
                  {doctor.name}
                </Text>
                <Text style={styles.doctorOptionSpec} numberOfLines={1}>
                  {doctor.specialty || specialty.title}
                </Text>
              </View>
              <View style={styles.doctorStatusPill}>
                <View style={styles.doctorStatusDot} />
                <Text style={styles.doctorStatusText}>Aktif</Text>
              </View>
            </View>

            <View style={styles.doctorActionRow}>
              <Button
                label="Reservasi"
                icon="calendar"
                iconPosition="left"
                variant="primary"
                size="sm"
                onPress={() => onBookDoctor(doctor)}
                style={styles.doctorActionButton}
              />
              <Button
                label={startingDoctorId === doctor.id ? 'Membuka...' : 'Konsultasi'}
                icon="chatbubbles"
                iconPosition="left"
                variant="success"
                size="sm"
                loading={startingDoctorId === doctor.id}
                disabled={!!startingDoctorId}
                onPress={() => onConsultDoctor(doctor)}
                style={styles.doctorActionButton}
              />
            </View>
          </View>
        ))}
      </View>
    )}
  </View>
);

const DetailBlock = ({
  icon,
  title,
  items,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  items: string[];
}) => (
  <View style={styles.detailBlock}>
    <View style={styles.detailTitleRow}>
      <Ionicons name={icon} size={16} color={COLORS.textSecondary} />
      <Text style={styles.detailTitle}>{title}</Text>
    </View>
    <View style={styles.chipWrap}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText} numberOfLines={1}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.xxl,
    gap: SPACING.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
  },
  heroDesc: {
    ...TYPO.bodySm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  metaPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.brand100,
  },
  metaPillText: {
    ...TYPO.labelSm,
    color: COLORS.primary,
  },
  heroCta: {
    marginTop: SPACING.lg,
  },
  list: {
    gap: SPACING.md,
  },
  highlightCard: {
    borderColor: COLORS.brand200,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryText: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  detailGrid: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  detailBlock: {
    gap: SPACING.sm,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailTitle: {
    ...TYPO.labelSm,
    color: COLORS.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chipText: {
    ...TYPO.caption,
    color: COLORS.textSecondary,
  },
  bookLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.brand100,
  },
  bookLinkText: {
    ...TYPO.label,
    color: COLORS.primary,
  },
  doctorPanel: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  doctorPanelHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  doctorPanelTitle: {
    ...TYPO.h4,
    color: COLORS.textPrimary,
    flex: 1,
  },
  doctorPanelMeta: {
    ...TYPO.caption,
    color: COLORS.textMuted,
  },
  doctorLoading: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  doctorLoadingText: {
    ...TYPO.bodySm,
    color: COLORS.textMuted,
  },
  doctorEmpty: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  doctorEmptyText: {
    ...TYPO.bodySm,
    color: COLORS.textMuted,
    flex: 1,
  },
  doctorList: {
    gap: SPACING.sm,
  },
  doctorOptionCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.md,
  },
  doctorOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  doctorAvatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  doctorOptionText: {
    flex: 1,
    minWidth: 0,
  },
  doctorOptionName: {
    ...TYPO.label,
    color: COLORS.textPrimary,
  },
  doctorOptionSpec: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  doctorStatusPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accentLight,
  },
  doctorStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  doctorStatusText: {
    ...TYPO.caption,
    color: COLORS.accentDark,
    fontWeight: '700',
  },
  doctorActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  doctorActionButton: {
    flex: 1,
  },
});
