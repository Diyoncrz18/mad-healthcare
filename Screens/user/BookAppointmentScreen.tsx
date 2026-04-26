/**
 * BookAppointmentScreen — Formulir Reservasi Janji Medis
 * Multi-step form: pilih dokter → tanggal → waktu → keluhan → submit.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { Doctor } from '../types';
import { getCurrentUser } from '../services/authService';
import { fetchActiveDoctors } from '../services/doctorService';
import { fetchBookedSlots, createAppointment } from '../services/appointmentService';
import {
  ScreenHeader,
  Card,
  Button,
  InputField,
  IconBadge,
  LoadingState,
  InfoBanner,
} from '../components/ui';

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];

const generateDates = () => {
  const dates: { dbDate: string; day: string; date: string; month: string }[] = [];
  const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push({
      dbDate: `${year}-${month}-${day}`,
      day: namaHari[d.getDay()],
      date: String(d.getDate()),
      month: namaBulan[d.getMonth()],
    });
  }
  return dates;
};

export default function BookAppointmentScreen({ navigation }: any) {
  const availableDates = useMemo(() => generateDates(), []);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [patientName, setPatientName] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const loadDoctors = async () => {
    setFetching(true);
    try {
      const data = await fetchActiveDoctors();
      setDoctors(data);
    } catch (err: any) {
      Alert.alert('Gagal Memuat Dokter', err.message);
    }
    setFetching(false);
  };

  const checkAvailableSlots = async (docId: string, dateStr: string) => {
    if (!docId || !dateStr) return;
    try {
      const slots = await fetchBookedSlots(docId, dateStr);
      setBookedSlots(slots);
    } catch (err: any) {
      Alert.alert('Gagal Cek Slot', err.message);
    }
  };

  useEffect(() => { loadDoctors(); }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      checkAvailableSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  const handleBook = async () => {
    if (!patientName || !selectedDoctor || !selectedDate || !selectedTime || !symptoms) {
      Alert.alert(
        'Data Belum Lengkap',
        'Mohon lengkapi nama pasien, dokter, tanggal, jam, dan keluhan.'
      );
      return;
    }

    setLoading(true);
    try {
      const user = await getCurrentUser();
      const datetimeStr = `${selectedDate} | ${selectedTime}`;
      await createAppointment({
        user_id: user?.id || '',
        patient_name: patientName,
        doctor_id: selectedDoctor.id,
        doctor_name: selectedDoctor.name,
        date: datetimeStr,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        symptoms,
      });
      Alert.alert('Reservasi Berhasil', 'Janji temu Anda telah berhasil dibuat.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Gagal Memesan', err.message);
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat ketersediaan jadwal…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Reservasi Baru"
            subtitle="Lengkapi formulir untuk membuat janji temu dengan dokter pilihan Anda."
          />

          <View style={styles.body}>
            {/* 1 — Patient Name */}
            <FormStep step="1" icon="person" title="Nama Pasien">
              <InputField
                placeholder="Masukkan nama lengkap pasien"
                value={patientName}
                onChangeText={setPatientName}
              />
            </FormStep>

            {/* 2 — Doctor */}
            <FormStep step="2" icon="medkit" title="Pilih Dokter">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {doctors.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Tidak ada dokter aktif saat ini.
                  </Text>
                ) : (
                  doctors.map((doc) => {
                    const isActive = selectedDoctor?.id === doc.id;
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSelectedDoctor(doc);
                          setSelectedTime('');
                        }}
                        style={[
                          styles.doctorCard,
                          isActive && styles.doctorCardActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.doctorAvatar,
                            isActive && styles.doctorAvatarActive,
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={20}
                            color={isActive ? COLORS.surface : COLORS.primary}
                          />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.doctorName,
                            isActive && styles.textOnActive,
                          ]}
                        >
                          {doc.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.doctorSpec,
                            isActive && { color: 'rgba(255,255,255,0.85)' },
                          ]}
                        >
                          {doc.specialty}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </FormStep>

            {/* 3 — Date */}
            <FormStep step="3" icon="calendar" title="Tentukan Tanggal">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {availableDates.map((item) => {
                  const isActive = selectedDate === item.dbDate;
                  return (
                    <TouchableOpacity
                      key={item.dbDate}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedDate(item.dbDate);
                        setSelectedTime('');
                      }}
                      style={[
                        styles.dateCard,
                        isActive && styles.dateCardActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateDay,
                          isActive && styles.textOnActive,
                        ]}
                      >
                        {item.day}
                      </Text>
                      <Text
                        style={[
                          styles.dateNum,
                          isActive && styles.textOnActive,
                        ]}
                      >
                        {item.date}
                      </Text>
                      <Text
                        style={[
                          styles.dateMonth,
                          isActive && { color: 'rgba(255,255,255,0.85)' },
                        ]}
                      >
                        {item.month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </FormStep>

            {/* 4 — Time */}
            <FormStep step="4" icon="time" title="Pilih Waktu Konsultasi">
              {selectedDoctor && selectedDate ? (
                <View style={styles.slotGrid}>
                  {TIME_SLOTS.map((slot) => {
                    const isTaken = bookedSlots.includes(slot);
                    const isActive = selectedTime === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        disabled={isTaken}
                        activeOpacity={0.85}
                        onPress={() => setSelectedTime(slot)}
                        style={[
                          styles.slot,
                          isActive && styles.slotActive,
                          isTaken && styles.slotTaken,
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            isActive && styles.textOnActive,
                            isTaken && styles.slotTextTaken,
                          ]}
                        >
                          {isTaken ? 'Penuh' : slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <InfoBanner
                  tone="info"
                  message="Pilih dokter dan tanggal di atas untuk melihat slot waktu yang tersedia."
                />
              )}
            </FormStep>

            {/* 5 — Symptoms */}
            <FormStep step="5" icon="document-text" title="Keluhan Penyakit">
              <InputField
                placeholder="Tuliskan gejala atau keluhan secara rinci…"
                value={symptoms}
                onChangeText={setSymptoms}
                multiline
              />
            </FormStep>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Konfirmasi Reservasi"
            onPress={handleBook}
            loading={loading}
            size="lg"
            icon="checkmark-circle"
            iconPosition="right"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────
const FormStep = ({
  step,
  icon,
  title,
  children,
}: {
  step: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <View style={styles.stepDot}>
        <Text style={styles.stepDotText}>{step}</Text>
      </View>
      <IconBadge icon={icon} tone="brand" size="sm" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: SPACING.xxl },

  body: { paddingHorizontal: SPACING.xl, gap: SPACING.xl },

  section: { gap: SPACING.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotText: { color: COLORS.surface, fontSize: 12, fontWeight: '800' },
  sectionTitle: { ...TYPO.h4, color: COLORS.textPrimary },
  sectionBody: { gap: SPACING.md },

  hScroll: { paddingVertical: SPACING.xs, gap: SPACING.md, paddingRight: SPACING.lg },

  // Doctor card
  doctorCard: {
    width: 160,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    gap: SPACING.sm,
  },
  doctorCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    ...SHADOWS.brand,
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorAvatarActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  doctorName: { ...TYPO.label, color: COLORS.textPrimary },
  doctorSpec: { ...TYPO.caption, color: COLORS.textMuted },
  textOnActive: { color: COLORS.surface },

  // Date card
  dateCard: {
    width: 64,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  dateCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateDay: { ...TYPO.caption, color: COLORS.textMuted },
  dateNum: { ...TYPO.h2, color: COLORS.textPrimary },
  dateMonth: { ...TYPO.caption, color: COLORS.textMuted },

  // Slots
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  slot: {
    width: '31%',
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  slotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  slotTaken: {
    backgroundColor: COLORS.borderLight,
    borderColor: COLORS.borderLight,
  },
  slotText: { ...TYPO.label, color: COLORS.textPrimary },
  slotTextTaken: { color: COLORS.textDisabled },

  emptyText: { ...TYPO.bodySm, color: COLORS.textDisabled, fontStyle: 'italic' },

  // Sticky footer
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.xl,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
  },
});
