/**
 * BookAppointmentScreen — Formulir Reservasi Janji Medis
 * Halaman multi-step untuk pasien membuat janji temu dengan dokter.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, Alert, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { Doctor } from '../types';
import { getCurrentUser } from '../services/authService';
import { fetchActiveDoctors } from '../services/doctorService';
import { fetchBookedSlots, createAppointment } from '../services/appointmentService';

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];

const generateDates = () => {
  const dates = [];
  const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dbDate = `${year}-${month}-${day}`;
    const uiDate = `${namaHari[d.getDay()]}, ${d.getDate()} ${namaBulan[d.getMonth()]}`;
    dates.push({ dbDate, uiDate });
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
      Alert.alert('Data Belum Lengkap', 'Mohon isi nama pasien, dokter, tanggal, jam, dan keluhan secara lengkap.');
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
      Alert.alert('Sukses 🎉', 'Janji temu Anda telah berhasil dibuat!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Gagal Memesan', err.message);
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.userPrimary} />
        <Text style={styles.loadingText}>Memuat ketersediaan jadwal...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Reservasi Baru</Text>
            <Text style={styles.headerSubtitle}>Lengkapi formulir untuk membuat janji temu dengan dokter pilihan Anda.</Text>
          </View>

          {/* 1. Nama Pasien */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color={COLORS.userPrimary} />
              <Text style={styles.sectionTitle}>Nama Pasien</Text>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Masukkan nama lengkap pasien..."
                placeholderTextColor={COLORS.textDisabled}
                value={patientName}
                onChangeText={setPatientName}
              />
            </View>
          </View>

          {/* 2. Pilih Dokter */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="medkit" size={20} color={COLORS.userPrimary} />
              <Text style={styles.sectionTitle}>Pilih Dokter</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {doctors.length === 0 ? <Text style={styles.emptyText}>Tidak ada dokter yang aktif saat ini.</Text> : doctors.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  style={[styles.cardItem, selectedDoctor?.id === doc.id && styles.cardSelected]}
                  onPress={() => { setSelectedDoctor(doc); setSelectedTime(''); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.avatarCircle, selectedDoctor?.id === doc.id && styles.avatarCircleSelected]}>
                    <Ionicons name="person" size={20} color={selectedDoctor?.id === doc.id ? COLORS.textOnPrimary : COLORS.textMuted} />
                  </View>
                  <Text style={[styles.cardTitle, selectedDoctor?.id === doc.id && styles.textWhite]}>{doc.name}</Text>
                  <Text style={[styles.cardSubtitle, selectedDoctor?.id === doc.id && styles.textWhiteLight]}>{doc.specialty}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 3. Pilih Tanggal */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color={COLORS.userPrimary} />
              <Text style={styles.sectionTitle}>Tentukan Tanggal</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={{ paddingRight: 20 }}>
              {availableDates.map((item) => (
                <TouchableOpacity
                  key={item.dbDate}
                  style={[styles.dateCard, selectedDate === item.dbDate && styles.cardSelected]}
                  onPress={() => { setSelectedDate(item.dbDate); setSelectedTime(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateDayText, selectedDate === item.dbDate && styles.textWhiteLight]}>{item.uiDate.split(', ')[0]}</Text>
                  <Text style={[styles.dateTextBold, selectedDate === item.dbDate && styles.textWhite]}>{item.uiDate.split(', ')[1]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 4. Pilih Waktu */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time" size={20} color={COLORS.userPrimary} />
              <Text style={styles.sectionTitle}>Pilih Waktu Konsultasi</Text>
            </View>
            {selectedDoctor && selectedDate ? (
              <View style={styles.slotContainer}>
                {TIME_SLOTS.map((slot) => {
                  const isTaken = bookedSlots.includes(slot);
                  return (
                    <TouchableOpacity
                      key={slot} disabled={isTaken}
                      style={[styles.slotBtn, selectedTime === slot && styles.slotBtnSelected, isTaken && styles.slotBtnDisabled]}
                      onPress={() => setSelectedTime(slot)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.slotText, selectedTime === slot && styles.textWhite, isTaken && styles.slotTextDisabled]}>
                        {isTaken ? 'Penuh' : slot}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle" size={20} color={COLORS.info} />
                <Text style={styles.warningText}>Silakan pilih dokter dan tanggal di atas terlebih dahulu untuk melihat waktu yang tersedia.</Text>
              </View>
            )}
          </View>

          {/* 5. Keluhan */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color={COLORS.userPrimary} />
              <Text style={styles.sectionTitle}>Keluhan Penyakit</Text>
            </View>
            <View style={[styles.inputWrapper, { height: 120, paddingVertical: 12 }]}>
              <TextInput
                style={styles.textArea}
                placeholder="Tuliskan keluhan atau gejala yang Anda alami secara rinci..."
                placeholderTextColor={COLORS.textDisabled}
                value={symptoms}
                onChangeText={setSymptoms}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

        </ScrollView>

        {/* Sticky Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleBook} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <>
                <Text style={styles.submitText}>Konfirmasi Reservasi</Text>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.textOnPrimary} style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.lg, color: COLORS.textMuted, fontSize: 16, fontWeight: '500' },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: SPACING.xxl, paddingTop: 30, paddingBottom: SPACING.xxl },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 15, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 22 },
  formSection: { marginBottom: 26 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginLeft: SPACING.sm },
  inputWrapper: {
    marginHorizontal: SPACING.xxl, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg, justifyContent: 'center',
    ...SHADOWS.sm, height: 56,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  textArea: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  horizontalScroll: { paddingLeft: SPACING.xxl, paddingVertical: SPACING.xs },
  emptyText: { color: COLORS.textDisabled, fontStyle: 'italic', fontSize: 14 },
  cardItem: {
    backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADIUS.xl,
    marginRight: SPACING.lg, width: 150, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'flex-start', ...SHADOWS.sm,
  },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.borderLight, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarCircleSelected: { backgroundColor: 'rgba(255,255,255,0.2)' },
  cardSelected: { backgroundColor: COLORS.userPrimary, borderColor: COLORS.userPrimary, shadowColor: COLORS.userPrimary, shadowOpacity: 0.2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 20 },
  cardSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.xs, fontWeight: '500' },
  dateCard: {
    backgroundColor: COLORS.surface, paddingVertical: 14, paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg, marginRight: SPACING.md, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dateDayText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 6, fontWeight: '500' },
  dateTextBold: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  textWhite: { color: COLORS.textOnPrimary },
  textWhiteLight: { color: '#DBEAFE' },
  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.infoBg,
    marginHorizontal: SPACING.xxl, padding: SPACING.lg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.infoBorder,
  },
  warningText: { color: COLORS.infoText, fontSize: 14, fontWeight: '500', marginLeft: SPACING.sm, flex: 1, lineHeight: 22 },
  slotContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginHorizontal: SPACING.xxl },
  slotBtn: {
    width: '30%', paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  slotBtnSelected: { backgroundColor: COLORS.userPrimary, borderColor: COLORS.userPrimary },
  slotBtnDisabled: { backgroundColor: COLORS.borderLight, borderColor: COLORS.borderLight },
  slotText: { fontWeight: '600', color: COLORS.textMuted, fontSize: 14 },
  slotTextDisabled: { color: COLORS.textDisabled },
  footer: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.xxl, paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 0 : SPACING.xxl,
    borderTopWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 10,
  },
  submitBtn: {
    backgroundColor: COLORS.userPrimary, paddingVertical: 18, borderRadius: RADIUS.lg,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.userPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4, marginBottom: 10,
  },
  submitText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 16 },
});
