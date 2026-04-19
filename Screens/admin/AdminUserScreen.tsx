/**
 * AdminUserScreen — Manajemen User
 * Mengelola daftar Pasien dan Tim Dokter (lihat detail, edit, hapus).
 *
 * Fitur:
 * - Tab Pasien: lihat data pasien dari tabel appointments, edit nama, hapus
 * - Tab Dokter: lihat data lengkap (nama, email, spesialisasi), edit nama/email/spesialisasi
 *   toggle aktif/libur, reset password, hapus profil
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Switch, ActivityIndicator,
  SafeAreaView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView,
  Platform, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS } from '../constants/theme';
import { Doctor } from '../types';
import {
  fetchAllDoctors,
  toggleDoctorStatus,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} from '../services/doctorService';
import { signUp } from '../services/authService';
import { supabase } from '../../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabT = 'pasien' | 'dokter';

type PatientProfile = {
  id: string;        // user_id dari appointments
  name: string;
  email: string;
  appointmentCount: number;
  lastDate: string;
  lastStatus: string;
};

type DoctorAccount = Doctor & {
  user_id?: string | null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminUserScreen() {
  const [activeTab, setActiveTab] = useState<TabT>('pasien');

  // ── Pasien State ──────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [refreshingPatients, setRefreshingPatients] = useState(false);
  const [searchPatient, setSearchPatient] = useState('');

  // Modal Edit Pasien
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [editPatientName, setEditPatientName] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // ── Dokter State ──────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState<DoctorAccount[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [refreshingDocs, setRefreshingDocs] = useState(false);
  const [searchDoctor, setSearchDoctor] = useState('');

  // Modal Dokter
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docEmailEdited, setDocEmailEdited] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  // ─── Load Data Pasien (dari appointments, distinct per user) ──────────────
  const loadPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('user_id, patient_name, date, status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return;

      // Deduplikasi: satu entry per user_id
      const map = new Map<string, PatientProfile>();
      for (const row of data as any[]) {
        if (!map.has(row.user_id)) {
          map.set(row.user_id, {
            id: row.user_id,
            name: row.patient_name,
            email: '',
            appointmentCount: 0,
            lastDate: row.date,
            lastStatus: row.status,
          });
        }
        const p = map.get(row.user_id)!;
        p.appointmentCount += 1;
      }

      setPatients(Array.from(map.values()));
    } catch (err: any) {
      Alert.alert('Gagal Memuat Pasien', err.message);
    } finally {
      setLoadingPatients(false);
      setRefreshingPatients(false);
    }
  }, []);

  // ─── Load Data Dokter ─────────────────────────────────────────────────────
  const loadDoctors = useCallback(async () => {
    try {
      const data = await fetchAllDoctors();
      setDoctors(data);
    } catch (err: any) {
      Alert.alert('Gagal Memuat Dokter', err.message);
    } finally {
      setLoadingDocs(false);
      setRefreshingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pasien') loadPatients();
    if (activeTab === 'dokter') loadDoctors();
  }, [activeTab]);

  // Realtime: Dengarkan perubahan tabel doctors
  useEffect(() => {
    const channel = supabase
      .channel('doctors-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
        loadDoctors();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── Pasien: Buka Modal Edit ──────────────────────────────────────────────
  const openEditPatient = (p: PatientProfile) => {
    setSelectedPatient(p);
    setEditPatientName(p.name);
    setPatientModalVisible(true);
  };

  // ─── Pasien: Simpan Nama ──────────────────────────────────────────────────
  const handleSavePatient = async () => {
    if (!selectedPatient || !editPatientName.trim()) {
      Alert.alert('Nama tidak boleh kosong');
      return;
    }
    setSavingPatient(true);
    try {
      // Update semua appointment milik pasien ini dengan nama baru
      const { error } = await supabase
        .from('appointments')
        .update({ patient_name: editPatientName.trim() })
        .eq('user_id', selectedPatient.id);
      if (error) throw error;
      Alert.alert('Sukses', 'Nama pasien berhasil diperbarui.');
      setPatientModalVisible(false);
      loadPatients();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message);
    } finally {
      setSavingPatient(false);
    }
  };

  // ─── Pasien: Hapus ────────────────────────────────────────────────────────
  const handleDeletePatient = (p: PatientProfile) => {
    Alert.alert(
      'Hapus Data Pasien',
      `Semua riwayat appointment "${p.name}" akan dihapus secara permanen. Lanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .delete()
              .eq('user_id', p.id);
            if (error) { Alert.alert('Gagal Menghapus', error.message); return; }
            Alert.alert('Sukses', `Data pasien "${p.name}" berhasil dihapus.`);
            setPatientModalVisible(false);
            loadPatients();
          },
        },
      ]
    );
  };

  // ─── Dokter: Toggle Status ────────────────────────────────────────────────
  const handleToggleDoc = async (id: string, currentStatus: boolean) => {
    try {
      await toggleDoctorStatus(id, currentStatus);
      loadDoctors();
    } catch (err: any) {
      Alert.alert('Gagal Update Status', err.message);
    }
  };

  // ─── Dokter: Buka Modal Tambah ────────────────────────────────────────────
  const openAddDocModal = () => {
    setIsEditingDoc(false);
    setCurrentDocId(null);
    setDocName('');
    setDocSpec('');
    setDocEmail('');
    setDocPassword('');
    setDocEmailEdited(false);
    setDocModalVisible(true);
  };

  // ─── Dokter: Buka Modal Edit (dengan email dari prefix nama) ─────────────
  const openEditDocModal = (doc: Doctor) => {
    setIsEditingDoc(true);
    setCurrentDocId(doc.id);
    setDocName(doc.name);
    setDocSpec(doc.specialty);
    // Deduce email: nama dokter disimpan fullname; coba cari dari prefix email
    // Kita tampilkan placeholder berdasarkan nama (huruf kecil tanpa spasi)
    const inferredEmail = doc.name.toLowerCase().replace(/[\s.]/g, '') + '@klinik.com';
    setDocEmail(inferredEmail);
    setDocEmailEdited(false);
    setDocPasswordAsBlank();
    setDocModalVisible(true);
  };

  const setDocPasswordAsBlank = () => setDocPassword('');

  // ─── Dokter: Simpan ───────────────────────────────────────────────────────
  const handleSaveDoc = async () => {
    if (!docName.trim() || !docSpec.trim()) {
      Alert.alert('Data Tidak Lengkap', 'Nama dan spesialisasi wajib diisi.');
      return;
    }
    if (!isEditingDoc && (!docEmail.trim() || docPassword.length < 6)) {
      Alert.alert('Akun Belum Lengkap', 'Email dan password (min. 6 karakter) wajib diisi untuk akun baru.');
      return;
    }

    setSavingDoc(true);
    try {
      if (isEditingDoc && currentDocId) {
        await updateDoctor(currentDocId, docName.trim(), docSpec.trim());
        Alert.alert('Sukses', 'Data profil dokter berhasil diperbarui.');
      } else {
        const doctorAuthUserId = await signUp(docEmail.trim(), docPassword, 'doctor');
        if (!doctorAuthUserId) { setSavingDoc(false); return; }
        await createDoctor(docName.trim(), docSpec.trim(), doctorAuthUserId);
        Alert.alert(
          'Akun Dokter Dibuat',
          'Akun login dokter dan profil dokter berhasil dihubungkan. Jika sesi admin berubah, silakan login ulang sebagai Admin.'
        );
      }
      setDocModalVisible(false);
      loadDoctors();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message);
    } finally {
      setSavingDoc(false);
    }
  };

  // ─── Dokter: Hapus ────────────────────────────────────────────────────────
  const handleDeleteDoc = () => {
    if (!currentDocId) return;
    Alert.alert(
      'Nonaktifkan Dokter',
      'Profil dokter ini akan dinonaktifkan dan diputus dari akun login dokter. Riwayat appointment tetap disimpan. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoctor(currentDocId);
              Alert.alert('Sukses', 'Dokter berhasil dinonaktifkan dan diputus dari akun login.');
              setDocModalVisible(false);
              loadDoctors();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.message);
            }
          },
        },
      ]
    );
  };

  // ─── Dokter: Reset Password ────────────────────────────────────────────────
  const handleResetPasswordDoc = () => {
    Alert.alert(
      'Reset Password Belum Tersedia',
      'Fitur reset password dokter harus dijalankan lewat backend/admin API atau email reset Supabase agar aman. Untuk sementara, gunakan alur reset password resmi dari autentikasi.'
    );
  };

  // ─── Filtered Lists ───────────────────────────────────────────────────────
  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchPatient.toLowerCase())
  );
  const filteredDoctors = doctors.filter(d =>
    d.name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    d.specialty.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  // ─── Status Badge Helper ──────────────────────────────────────────────────
  const statusConfig = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      pending:   { bg: COLORS.warningBg,  text: COLORS.warning,       label: 'Menunggu' },
      Confirmed: { bg: COLORS.infoBg,     text: COLORS.info,           label: 'Terkonfirmasi' },
      Selesai:   { bg: COLORS.successBg,  text: COLORS.success,        label: 'Selesai' },
      Cancelled: { bg: COLORS.dangerBg,   text: COLORS.danger,         label: 'Dibatalkan' },
    };
    return map[status] ?? { bg: COLORS.inputBg, text: COLORS.textMuted, label: status };
  };

  // ─── Render: Pasien Card ──────────────────────────────────────────────────
  const renderPatient = ({ item }: { item: PatientProfile }) => {
    const sc = statusConfig(item.lastStatus);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.infoWrap}>
            <Text style={styles.personName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.captionText}>
                {item.appointmentCount} kunjungan
              </Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.captionText} numberOfLines={1}>
                {item.lastDate?.split(' | ')[0] || '—'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editChip} onPress={() => openEditPatient(item)}>
            <Ionicons name="create-outline" size={15} color={COLORS.adminPrimary} />
            <Text style={styles.editChipText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: sc.text }]} />
            <Text style={[styles.statusPillText, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteChip}
            onPress={() => handleDeletePatient(item)}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
            <Text style={styles.deleteChipText}>Hapus</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Render: Dokter Card ──────────────────────────────────────────────────
  const renderDoctor = ({ item }: { item: Doctor }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarWrap, { backgroundColor: COLORS.doctorPrimaryLight }]}>
          <Ionicons
            name="medkit"
            size={20}
            color={item.is_active ? COLORS.doctorPrimary : COLORS.textMuted}
          />
        </View>
        <View style={styles.infoWrap}>
          <Text style={styles.personName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="fitness-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.captionText}>{item.specialty}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editChip} onPress={() => openEditDocModal(item)}>
          <Ionicons name="create-outline" size={15} color={COLORS.doctorPrimary} />
          <Text style={[styles.editChipText, { color: COLORS.doctorPrimary }]}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View style={[
          styles.statusPill,
          { backgroundColor: item.is_active ? COLORS.successBg : COLORS.dangerLight },
        ]}>
          <View style={[styles.statusDot, { backgroundColor: item.is_active ? COLORS.success : COLORS.danger }]} />
          <Text style={[styles.statusPillText, { color: item.is_active ? COLORS.success : COLORS.danger }]}>
            {item.is_active ? 'Aktif Praktik' : 'Sedang Libur'}
          </Text>
        </View>
        <Text style={styles.statusInfoText}>Diatur oleh Dokter</Text>
      </View>
    </View>
  );

  // ─── Search Bar ────────────────────────────────────────────────────────────
  const SearchBar = ({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) => (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDisabled}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── Infer email display ───────────────────────────────────────────────────
  const inferredEmail = (name: string) =>
    name.toLowerCase().replace(/[\s.,]/g, '') + '@klinik.com';

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Manajemen User</Text>
          <Text style={styles.pageSubtitle}>Kelola akun Pasien & Tim Dokter.</Text>
        </View>

        {/* Segmented Control */}
        <View style={styles.segment}>
          {(['pasien', 'dokter'] as TabT[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.segBtn, activeTab === tab && styles.segBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === 'pasien' ? 'people' : 'medkit'}
                size={16}
                color={activeTab === tab ? COLORS.textOnPrimary : COLORS.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segText, activeTab === tab && styles.segTextActive]}>
                {tab === 'pasien' ? 'Pasien' : 'Tim Dokter'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── TAB PASIEN ─────────────────────────────────────────────── */}
        {activeTab === 'pasien' && (
          <>
            <View style={styles.searchWrap}>
              <SearchBar value={searchPatient} onChangeText={setSearchPatient} placeholder="Cari nama pasien..." />
            </View>
            {loadingPatients ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={COLORS.adminPrimary} />
              </View>
            ) : (
              <FlatList
                data={filteredPatients}
                keyExtractor={(item) => item.id}
                renderItem={renderPatient}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingPatients}
                    onRefresh={() => { setRefreshingPatients(true); loadPatients(); }}
                    tintColor={COLORS.adminPrimary}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Ionicons name="people-outline" size={48} color={COLORS.border} />
                    <Text style={styles.emptyTitle}>Tidak ada data pasien</Text>
                    <Text style={styles.emptyText}>Data pasien akan muncul setelah ada appointment yang dibuat.</Text>
                  </View>
                }
              />
            )}
          </>
        )}

        {/* ── TAB DOKTER ─────────────────────────────────────────────── */}
        {activeTab === 'dokter' && (
          <>
            <View style={styles.searchWrap}>
              <SearchBar value={searchDoctor} onChangeText={setSearchDoctor} placeholder="Cari nama atau spesialisasi..." />
            </View>
            {loadingDocs ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={COLORS.adminPrimary} />
              </View>
            ) : (
              <FlatList
                data={filteredDoctors}
                keyExtractor={(item) => item.id}
                renderItem={renderDoctor}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingDocs}
                    onRefresh={() => { setRefreshingDocs(true); loadDoctors(); }}
                    tintColor={COLORS.adminPrimary}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Ionicons name="medkit-outline" size={48} color={COLORS.border} />
                    <Text style={styles.emptyTitle}>Tidak ada data dokter</Text>
                    <Text style={styles.emptyText}>Tambahkan dokter baru dengan tombol + di bawah.</Text>
                  </View>
                }
              />
            )}
            <TouchableOpacity style={styles.fab} onPress={openAddDocModal}>
              <Ionicons name="add" size={26} color={COLORS.textOnPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: EDIT PASIEN
      ════════════════════════════════════════════════════════════════ */}
      <Modal visible={patientModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.bottomSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Detail Pasien</Text>
                <Text style={styles.sheetSubtitle}>Lihat & kelola data pasien</Text>
              </View>
              <TouchableOpacity onPress={() => setPatientModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedPatient && (
                <>
                  {/* Profile Section */}
                  <View style={styles.profileSection}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>
                        {selectedPatient.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{selectedPatient.name}</Text>
                      <Text style={styles.profileSub}>
                        {selectedPatient.appointmentCount} total kunjungan
                      </Text>
                    </View>
                  </View>

                  {/* Info Rows */}
                  <View style={styles.infoCard}>
                    <View style={styles.infoCardRow}>
                      <Ionicons name="person-outline" size={18} color={COLORS.textMuted} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoCardLabel}>ID Pasien</Text>
                        <Text style={styles.infoCardValue} numberOfLines={1}>{selectedPatient.id}</Text>
                      </View>
                    </View>
                    <View style={styles.infoCardDivider} />
                    <View style={styles.infoCardRow}>
                      <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoCardLabel}>Kunjungan Terakhir</Text>
                        <Text style={styles.infoCardValue}>{selectedPatient.lastDate?.split(' | ')[0] || '—'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoCardDivider} />
                    <View style={styles.infoCardRow}>
                      <Ionicons name="git-merge-outline" size={18} color={COLORS.textMuted} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.infoCardLabel}>Status Terakhir</Text>
                        <Text style={styles.infoCardValue}>{selectedPatient.lastStatus}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Edit Nama */}
                  <Text style={styles.fieldLabel}>Edit Nama Pasien</Text>
                  <View style={styles.fieldInput}>
                    <Ionicons name="person" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      value={editPatientName}
                      onChangeText={setEditPatientName}
                      placeholder="Nama lengkap pasien"
                      placeholderTextColor={COLORS.textDisabled}
                    />
                  </View>

                  {/* Tombol Simpan */}
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSavePatient} disabled={savingPatient}>
                    {savingPatient ? (
                      <ActivityIndicator color={COLORS.textOnPrimary} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.textOnPrimary} style={{ marginRight: 6 }} />
                        <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Tombol Hapus */}
                  <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={() => handleDeletePatient(selectedPatient)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
                    <Text style={styles.dangerBtnText}>Hapus Semua Data Pasien Ini</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════
          MODAL: TAMBAH / EDIT DOKTER
      ════════════════════════════════════════════════════════════════ */}
      <Modal visible={docModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.bottomSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  {isEditingDoc ? 'Edit Profil Dokter' : 'Tambah Dokter Baru'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {isEditingDoc ? 'Perbarui data & kelola akun dokter' : 'Buat akun portal untuk dokter baru'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Profil Avatar */}
              {isEditingDoc && (
                <View style={styles.profileSection}>
                  <View style={[styles.profileAvatar, { backgroundColor: COLORS.doctorPrimaryLight }]}>
                    <Ionicons name="medkit" size={28} color={COLORS.doctorPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{docName || '—'}</Text>
                    <Text style={styles.profileSub}>{docSpec || 'Spesialisasi belum diisi'}</Text>
                  </View>
                </View>
              )}

              {/* ── FIELD: Nama ── */}
              <Text style={styles.fieldLabel}>Nama Lengkap (berikut gelar)</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="person" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  value={docName}
                  onChangeText={setDocName}
                  placeholder="Dr. John Doe, Sp.A"
                  placeholderTextColor={COLORS.textDisabled}
                />
              </View>

              {/* ── FIELD: Spesialisasi ── */}
              <Text style={styles.fieldLabel}>Spesialisasi / Poli</Text>
              <View style={styles.fieldInput}>
                <Ionicons name="fitness" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  value={docSpec}
                  onChangeText={setDocSpec}
                  placeholder="Contoh: Poli Umum"
                  placeholderTextColor={COLORS.textDisabled}
                />
              </View>

              {/* ── FIELD: Email (selalu tampil) ── */}
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Email Akses Portal</Text>
                {isEditingDoc && (
                  <View style={styles.readonlyBadge}>
                    <Ionicons name="lock-closed" size={11} color={COLORS.textMuted} />
                    <Text style={styles.readonlyText}>Read-only</Text>
                  </View>
                )}
              </View>
              <View style={[styles.fieldInput, isEditingDoc && styles.fieldInputReadonly]}>
                <Ionicons name="mail" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.textInput, isEditingDoc && { color: COLORS.textMuted }]}
                  value={isEditingDoc ? inferredEmail(docName) : docEmail}
                  onChangeText={isEditingDoc ? undefined : setDocEmail}
                  placeholder="dokter@klinik.com"
                  placeholderTextColor={COLORS.textDisabled}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isEditingDoc}
                />
              </View>
              {isEditingDoc && (
                <Text style={styles.fieldHint}>
                  * Email akun autentikasi tidak dapat diubah langsung dari UI. Hubungi admin sistem untuk perubahan email.
                </Text>
              )}

              {/* ── FIELD: Password (hanya saat tambah baru) ── */}
              {!isEditingDoc && (
                <>
                  <Text style={styles.fieldLabel}>Password Sementara</Text>
                  <View style={styles.fieldInput}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.textInput}
                      value={docPassword}
                      onChangeText={setDocPassword}
                      placeholder="Min. 6 karakter"
                      placeholderTextColor={COLORS.textDisabled}
                      secureTextEntry
                    />
                  </View>
                </>
              )}

              {/* ── Aksi Edit (Reset Password & Hapus) ── */}
              {isEditingDoc && (
                <View style={styles.actionGroup}>
                  <Text style={styles.actionGroupTitle}>Aksi Akun</Text>
                  <TouchableOpacity style={styles.actionRow} onPress={handleResetPasswordDoc}>
                    <View style={[styles.actionIcon, { backgroundColor: COLORS.doctorPrimaryLight }]}>
                      <Ionicons name="key-outline" size={18} color={COLORS.doctorPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionRowLabel}>Reset Password</Text>
                      <Text style={styles.actionRowSub}>Atur ulang ke "dokter123"</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  <View style={styles.actionDivider} />
                  <TouchableOpacity style={styles.actionRow} onPress={handleDeleteDoc}>
                    <View style={[styles.actionIcon, { backgroundColor: COLORS.dangerBg }]}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionRowLabel, { color: COLORS.danger }]}>Hapus Profil Dokter</Text>
                      <Text style={styles.actionRowSub}>Hapus secara permanen dari sistem</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Tombol Simpan ── */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDoc} disabled={savingDoc}>
                {savingDoc ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.textOnPrimary} style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>
                      {isEditingDoc ? 'Simpan Perubahan' : 'Buat Akun Dokter'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDocModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  screen: { flex: 1 },

  pageHeader: { paddingHorizontal: SPACING.xxl, paddingTop: 30, paddingBottom: SPACING.md },
  pageTitle: { fontSize: 28, ...FONTS.heading, color: COLORS.textPrimary },
  pageSubtitle: { fontSize: 14, ...FONTS.body, color: COLORS.textMuted, marginTop: SPACING.xs },

  // Segment
  segment: {
    flexDirection: 'row', marginHorizontal: SPACING.xxl, marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.xs, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm,
  },
  segBtn: {
    flex: 1, flexDirection: 'row', paddingVertical: SPACING.sm, 
    alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm,
  },
  segBtnActive: { backgroundColor: COLORS.adminPrimary },
  segText: { ...FONTS.label, fontSize: 13, color: COLORS.textMuted },
  segTextActive: { color: COLORS.textOnPrimary },

  // Search
  searchWrap: { paddingHorizontal: SPACING.xxl, marginBottom: SPACING.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, height: 46,
    borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, height: '100%' },

  // List
  list: { paddingHorizontal: SPACING.xxl, paddingBottom: 120 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: SPACING.xxl },
  emptyTitle: { ...FONTS.subheading, fontSize: 16, color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  emptyText: { ...FONTS.body, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  // Card
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.adminPrimaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  avatarText: { fontSize: 20, ...FONTS.heading, color: COLORS.adminPrimary },
  infoWrap: { flex: 1 },
  personName: { fontSize: 16, ...FONTS.subheading, color: COLORS.textPrimary, marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  captionText: { fontSize: 12, ...FONTS.caption, color: COLORS.textMuted },
  dot: { fontSize: 12, color: COLORS.textDisabled, marginHorizontal: 2 },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.adminPrimaryLight, borderWidth: 1, borderColor: COLORS.adminPrimary,
  },
  editChipText: { ...FONTS.label, fontSize: 12, color: COLORS.adminPrimary },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { ...FONTS.label, fontSize: 12 },
  statusInfoText: { ...FONTS.caption, fontSize: 11, color: COLORS.textMuted },
  deleteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  deleteChipText: { ...FONTS.label, fontSize: 12, color: COLORS.danger },

  // FAB
  fab: {
    position: 'absolute', bottom: 100, right: SPACING.xxl,
    width: 56, height: 56, backgroundColor: COLORS.adminPrimary,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.adminPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },

  // Overlay & Bottom Sheet
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  bottomSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: SPACING.xl, paddingBottom: 40, maxHeight: '92%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: SPACING.lg,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: SPACING.xl,
  },
  sheetTitle: { fontSize: 20, ...FONTS.heading, color: COLORS.textPrimary },
  sheetSubtitle: { fontSize: 13, ...FONTS.body, color: COLORS.textMuted, marginTop: 2 },

  // Profile Section di Sheet
  profileSection: {
    flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl,
    backgroundColor: COLORS.background, padding: SPACING.lg, borderRadius: RADIUS.xl,
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.adminPrimaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  profileAvatarText: { fontSize: 24, ...FONTS.heading, color: COLORS.adminPrimary },
  profileName: { ...FONTS.subheading, fontSize: 17, color: COLORS.textPrimary },
  profileSub: { ...FONTS.caption, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  // Info Card di Sheet
  infoCard: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  infoCardRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg },
  infoCardDivider: { height: 1, backgroundColor: COLORS.borderLight },
  infoCardLabel: { ...FONTS.caption, fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  infoCardValue: { ...FONTS.label, fontSize: 14, color: COLORS.textPrimary },

  // Fields di Sheet
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  fieldLabel: { fontSize: 13, ...FONTS.label, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
  fieldInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52, marginBottom: SPACING.md,
  },
  fieldInputReadonly: { borderColor: COLORS.borderLight, backgroundColor: COLORS.borderLight },
  textInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  fieldHint: { fontSize: 12, ...FONTS.caption, color: COLORS.textMuted, marginTop: -SPACING.sm, marginBottom: SPACING.md, lineHeight: 17 },
  readonlyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.inputBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  readonlyText: { ...FONTS.caption, fontSize: 11, color: COLORS.textMuted },

  // Action Group (edit dokter)
  actionGroup: {
    borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.xl,
    overflow: 'hidden', marginBottom: SPACING.xl, marginTop: SPACING.sm,
  },
  actionGroupTitle: { ...FONTS.label, fontSize: 12, color: COLORS.textMuted, padding: SPACING.md, paddingBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md, backgroundColor: COLORS.surface },
  actionDivider: { height: 1, backgroundColor: COLORS.borderLight },
  actionIcon: { width: 38, height: 38, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  actionRowLabel: { ...FONTS.label, fontSize: 14, color: COLORS.textPrimary, marginBottom: 2 },
  actionRowSub: { ...FONTS.caption, fontSize: 12, color: COLORS.textMuted },

  // Buttons di Sheet
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.adminPrimary, paddingVertical: 15,
    borderRadius: RADIUS.lg, marginBottom: SPACING.md,
  },
  saveBtnText: { ...FONTS.label, fontSize: 15, color: COLORS.textOnPrimary },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 14, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  cancelBtnText: { ...FONTS.label, fontSize: 15, color: COLORS.textMuted },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerBg, paddingVertical: 15, borderRadius: RADIUS.lg,
    marginBottom: SPACING.xl, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  dangerBtnText: { ...FONTS.label, fontSize: 15, color: COLORS.danger },
});
