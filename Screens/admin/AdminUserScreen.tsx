/**
 * AdminUserScreen — Manajemen User (REDESIGN)
 *
 * Konsisten dengan design system:
 *   - ScreenHeader, Card, Button, InputField, IconBadge, StatusBadge
 *   - LoadingState / EmptyState / ErrorState
 *   - Modal bottom-sheet dengan Card-based sections
 *
 * Bug fix:
 *   - loadPatients fault-tolerant: kalau patient_profiles belum ada
 *     (migration belum di-apply), fall back ke appointments-only.
 *
 * Fitur:
 *   - Tab Pasien: list dengan email + visit count + status terakhir
 *   - Tab Dokter: list dengan specialty + active status
 *   - Search per tab
 *   - Edit / Delete patient (hapus semua appointment milik user)
 *   - Add / Edit doctor (full account creation untuk new)
 *   - Realtime subscription untuk perubahan doctors
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
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
import {
  ScreenHeader,
  Card,
  Button,
  InputField,
  IconBadge,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
  InfoBanner,
} from '../components/ui';
import type { StatusKind } from '../components/ui';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════
type TabT = 'pasien' | 'dokter';

type PatientProfile = {
  id: string;
  name: string;
  email: string;
  appointmentCount: number;
  lastDate: string;
  lastStatus: string;
};

const DOCTOR_SPECIALTIES = [
  'Dokter Umum',
  'Dokter Gigi',
  'Dokter Anak',
  'Dokter Kandungan',
  'Dokter Penyakit Dalam',
  'Dokter Bedah',
  'Dokter Mata',
  'Dokter THT',
  'Dokter Kulit dan Kelamin',
  'Dokter Saraf',
  'Dokter Jantung',
  'Dokter Paru',
  'Dokter Ortopedi',
  'Dokter Psikiatri',
  'Dokter Urologi',
  'Dokter Radiologi',
  'Dokter Gizi Klinik',
];

const statusToKind = (status: string): StatusKind => {
  if (status === 'pending') return 'pending';
  if (status === 'Confirmed') return 'confirmed';
  if (status === 'Selesai') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  return 'neutral';
};

const inferDoctorEmail = (name: string): string =>
  name.toLowerCase().replace(/[\s.]/g, '') + '@klinik.com';

const normalizeDoctorSpecialty = (specialty: string): string => {
  const normalized = specialty.trim().toLowerCase();
  const aliases: Record<string, string> = {
    umum: 'Dokter Umum',
    'poli umum': 'Dokter Umum',
    gigi: 'Dokter Gigi',
    'poli gigi': 'Dokter Gigi',
  };
  if (!normalized) return '';
  return (
    aliases[normalized] ||
    DOCTOR_SPECIALTIES.find((item) => item.toLowerCase() === normalized) ||
    specialty
  );
};

// ════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════
export default function AdminUserScreen() {
  const [activeTab, setActiveTab] = useState<TabT>('pasien');

  // Pasien State
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [refreshingPatients, setRefreshingPatients] = useState(false);
  const [searchPatient, setSearchPatient] = useState('');
  const [patientErrorMsg, setPatientErrorMsg] = useState('');
  const [patientWarning, setPatientWarning] = useState('');

  // Modal Edit Pasien
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [editPatientName, setEditPatientName] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // Dokter State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [refreshingDocs, setRefreshingDocs] = useState(false);
  const [searchDoctor, setSearchDoctor] = useState('');
  const [doctorErrorMsg, setDoctorErrorMsg] = useState('');

  // Modal Dokter
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);

  // ─── Load Pasien (fault-tolerant) ──────────────────────────────────
  const loadPatients = useCallback(async () => {
    setPatientErrorMsg('');
    setPatientWarning('');
    try {
      // Step 1: Fetch appointments (always works)
      const { data: apptsData, error: apptsError } = await supabase
        .from('appointments')
        .select('user_id, patient_name, date, status, created_at')
        .order('created_at', { ascending: false });
      if (apptsError) throw apptsError;

      // Aggregate appointments per user
      const apptMap = new Map<
        string,
        { count: number; lastDate: string; lastStatus: string; latestName: string }
      >();
      for (const row of (apptsData || []) as any[]) {
        if (!row.user_id) continue;
        const existing = apptMap.get(row.user_id);
        if (existing) {
          existing.count += 1;
        } else {
          apptMap.set(row.user_id, {
            count: 1,
            lastDate: row.date,
            lastStatus: row.status,
            latestName: row.patient_name,
          });
        }
      }

      // Step 2: Try fetch patient_profiles — silent fail
      let profiles: { user_id: string; email: string; display_name: string | null }[] = [];
      let profilesAvailable = false;
      try {
        const { data, error } = await supabase
          .from('patient_profiles')
          .select('user_id, email, display_name')
          .order('created_at', { ascending: false });
        if (!error && data) {
          profiles = data as any[];
          profilesAvailable = true;
        } else if (error) {
          // Tabel tidak ada / RLS issue — silent fall back
          setPatientWarning(
            'Email pasien belum tersedia. Migration database mungkin belum di-apply.'
          );
        }
      } catch {
        setPatientWarning(
          'Email pasien belum tersedia. Migration database mungkin belum di-apply.'
        );
      }

      // Step 3: Merge — patient_profiles + appointments
      const map = new Map<string, PatientProfile>();
      for (const profile of profiles) {
        const appt = apptMap.get(profile.user_id);
        map.set(profile.user_id, {
          id: profile.user_id,
          name: appt?.latestName || profile.display_name || '(Tanpa Nama)',
          email: profile.email || '',
          appointmentCount: appt?.count || 0,
          lastDate: appt?.lastDate || '—',
          lastStatus: appt?.lastStatus || '—',
        });
      }
      for (const [userId, appt] of apptMap.entries()) {
        if (!map.has(userId)) {
          map.set(userId, {
            id: userId,
            name: appt.latestName,
            email: '',
            appointmentCount: appt.count,
            lastDate: appt.lastDate,
            lastStatus: appt.lastStatus,
          });
        }
      }

      setPatients(Array.from(map.values()));
    } catch (err: any) {
      setPatientErrorMsg(err.message || 'Gagal memuat data pasien.');
    } finally {
      setLoadingPatients(false);
      setRefreshingPatients(false);
    }
  }, []);

  // ─── Load Dokter ───────────────────────────────────────────────────
  const loadDoctors = useCallback(async () => {
    setDoctorErrorMsg('');
    try {
      const data = await fetchAllDoctors();
      setDoctors(data);
    } catch (err: any) {
      setDoctorErrorMsg(err.message || 'Gagal memuat data dokter.');
    } finally {
      setLoadingDocs(false);
      setRefreshingDocs(false);
    }
  }, []);

  // Reload saat tab berubah
  useEffect(() => {
    if (activeTab === 'pasien') loadPatients();
    if (activeTab === 'dokter') loadDoctors();
  }, [activeTab, loadPatients, loadDoctors]);

  // Realtime: dengarkan perubahan tabel doctors
  useEffect(() => {
    const channel = supabase
      .channel('doctors-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors' },
        () => loadDoctors()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDoctors]);

  // ─── Pasien: Edit & Delete ─────────────────────────────────────────
  const openEditPatient = (p: PatientProfile) => {
    setSelectedPatient(p);
    setEditPatientName(p.name);
    setPatientModalVisible(true);
  };

  const handleSavePatient = async () => {
    if (!selectedPatient || !editPatientName.trim()) {
      Alert.alert('Nama tidak boleh kosong');
      return;
    }
    setSavingPatient(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ patient_name: editPatientName.trim() })
        .eq('user_id', selectedPatient.id);
      if (error) throw error;
      Alert.alert('Berhasil', 'Nama pasien berhasil diperbarui.');
      setPatientModalVisible(false);
      loadPatients();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message);
    } finally {
      setSavingPatient(false);
    }
  };

  const handleDeletePatient = (p: PatientProfile) => {
    Alert.alert(
      'Hapus Riwayat Pasien',
      `Semua riwayat appointment "${p.name}" akan dihapus permanen. Akun login pasien tetap aktif. Lanjutkan?`,
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
            if (error) {
              Alert.alert('Gagal Menghapus', error.message);
              return;
            }
            Alert.alert('Berhasil', `Riwayat appointment "${p.name}" telah dihapus.`);
            setPatientModalVisible(false);
            loadPatients();
          },
        },
      ]
    );
  };

  // ─── Dokter: CRUD ──────────────────────────────────────────────────
  const closeDocModal = () => {
    setDocModalVisible(false);
    setSpecDropdownOpen(false);
  };

  const openAddDocModal = () => {
    setIsEditingDoc(false);
    setCurrentDocId(null);
    setDocName('');
    setDocSpec('');
    setDocEmail('');
    setDocPassword('');
    setSpecDropdownOpen(false);
    setDocModalVisible(true);
  };

  const openEditDocModal = (doc: Doctor) => {
    setIsEditingDoc(true);
    setCurrentDocId(doc.id);
    setDocName(doc.name);
    setDocSpec(normalizeDoctorSpecialty(doc.specialty));
    setDocEmail(inferDoctorEmail(doc.name));
    setDocPassword('');
    setSpecDropdownOpen(false);
    setDocModalVisible(true);
  };

  const handleSelectSpecialty = (specialty: string) => {
    setDocSpec(specialty);
    setSpecDropdownOpen(false);
  };

  const handleSaveDoc = async () => {
    if (!docName.trim() || !docSpec.trim()) {
      Alert.alert('Data Tidak Lengkap', 'Nama dan spesialisasi dokter wajib dipilih.');
      return;
    }
    if (!isEditingDoc && (!docEmail.trim() || docPassword.length < 6)) {
      Alert.alert(
        'Akun Belum Lengkap',
        'Email dan password (min. 6 karakter) wajib diisi untuk akun baru.'
      );
      return;
    }

    setSavingDoc(true);
    try {
      if (isEditingDoc && currentDocId) {
        await updateDoctor(currentDocId, docName.trim(), docSpec.trim());
        Alert.alert('Berhasil', 'Profil dokter berhasil diperbarui.');
      } else {
        // Pass nama & spesialisasi sebagai metadata agar trigger
        // `handle_new_doctor()` di Supabase memakai nilai yang benar
        // (bukan default 'Dokter Umum'). createDoctor() di bawah idempotent —
        // akan UPDATE bila trigger sudah membuat baris, atau INSERT bila belum.
        const doctorAuthUserId = await signUp(docEmail.trim(), docPassword, 'doctor', {
          displayName: docName.trim(),
          specialty: docSpec.trim(),
        });
        if (!doctorAuthUserId) {
          setSavingDoc(false);
          return;
        }
        await createDoctor(docName.trim(), docSpec.trim(), doctorAuthUserId);
        Alert.alert(
          'Akun Dokter Dibuat',
          'Akun login & profil dokter berhasil terhubung. Jika sesi admin berubah, login ulang sebagai admin.'
        );
      }
      closeDocModal();
      loadDoctors();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message);
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDoc = () => {
    if (!currentDocId) return;
    Alert.alert(
      'Nonaktifkan Dokter',
      'Profil dokter akan dinonaktifkan dan diputus dari akun login. Riwayat appointment tetap disimpan. Lanjutkan?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Nonaktifkan',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoctor(currentDocId);
              Alert.alert('Berhasil', 'Dokter berhasil dinonaktifkan.');
              closeDocModal();
              loadDoctors();
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          },
        },
      ]
    );
  };

  // ─── Filtered ──────────────────────────────────────────────────────
  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.email.toLowerCase().includes(searchPatient.toLowerCase())
  );
  const filteredDoctors = doctors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
      d.specialty.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  // ─── Render Patient Card ───────────────────────────────────────────
  const renderPatient = ({ item }: { item: PatientProfile }) => {
    const initial = item.name.charAt(0).toUpperCase() || '?';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openEditPatient(item)}
        accessibilityRole="button"
      >
        <Card variant="default" padding="md" style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.avatarPatient}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {!!item.email && (
                <Text style={styles.itemEmail} numberOfLines={1}>
                  {item.email}
                </Text>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>
                  {item.appointmentCount} kunjungan
                </Text>
                {item.lastStatus !== '—' && (
                  <>
                    <Text style={styles.metaDot}>•</Text>
                    <StatusBadge
                      kind={statusToKind(item.lastStatus)}
                      showIcon={false}
                    />
                  </>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  // ─── Render Doctor Card ────────────────────────────────────────────
  const renderDoctor = ({ item }: { item: Doctor }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => openEditDocModal(item)}
      accessibilityRole="button"
    >
      <Card variant="default" padding="md" style={styles.itemCard}>
        <View style={styles.itemRow}>
          <IconBadge
            icon="medkit"
            tone={item.is_active ? 'doctor' : 'neutral'}
            size="md"
          />
          <View style={styles.itemBody}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {item.specialty}
            </Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: item.is_active
                      ? COLORS.success
                      : COLORS.textDisabled,
                  },
                ]}
              />
              <Text
                style={[
                  styles.metaText,
                  {
                    color: item.is_active ? COLORS.success : COLORS.textMuted,
                    fontWeight: '600',
                  },
                ]}
              >
                {item.is_active ? 'Aktif Praktik' : 'Sedang Libur'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textDisabled} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  // ════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Manajemen User"
        subtitle="Kelola data pasien dan tim dokter klinik"
      />

      {/* Segment Tab */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(
            [
              { key: 'pasien', label: 'Pasien', icon: 'people' as const, count: patients.length },
              { key: 'dokter', label: 'Tim Dokter', icon: 'medkit' as const, count: doctors.length },
            ] as { key: TabT; label: string; icon: 'people' | 'medkit'; count: number }[]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.segBtn, isActive && styles.segBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? COLORS.textOnPrimary : COLORS.textMuted}
                />
                <Text style={[styles.segText, isActive && styles.segTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View
                    style={[
                      styles.countPill,
                      isActive && styles.countPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        isActive && styles.countTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <InputField
          icon="search-outline"
          placeholder={
            activeTab === 'pasien'
              ? 'Cari nama atau email pasien…'
              : 'Cari nama atau spesialisasi dokter…'
          }
          value={activeTab === 'pasien' ? searchPatient : searchDoctor}
          onChangeText={
            activeTab === 'pasien' ? setSearchPatient : setSearchDoctor
          }
          autoCapitalize="none"
        />
      </View>

      {/* TAB PASIEN */}
      {activeTab === 'pasien' && (
        <View style={styles.tabContent}>
          {loadingPatients ? (
            <LoadingState fullscreen label="Memuat data pasien…" />
          ) : (
            <>
              {!!patientWarning && (
                <View style={styles.bannerWrap}>
                  <InfoBanner
                    tone="warning"
                    title="Data Email Belum Tersedia"
                    message={patientWarning}
                  />
                </View>
              )}
              {!!patientErrorMsg && (
                <View style={styles.bannerWrap}>
                  <ErrorState message={patientErrorMsg} onRetry={loadPatients} />
                </View>
              )}
              <FlatList
                data={filteredPatients}
                keyExtractor={(item) => item.id}
                renderItem={renderPatient}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingPatients}
                    onRefresh={() => {
                      setRefreshingPatients(true);
                      loadPatients();
                    }}
                    tintColor={COLORS.adminPrimary}
                  />
                }
                ListEmptyComponent={
                  !patientErrorMsg ? (
                    <EmptyState
                      icon="people-outline"
                      title={
                        searchPatient
                          ? 'Pasien tidak ditemukan'
                          : 'Belum ada pasien terdaftar'
                      }
                      description={
                        searchPatient
                          ? `Tidak ada hasil untuk "${searchPatient}".`
                          : 'Data pasien akan muncul setelah ada pendaftaran atau appointment.'
                      }
                    />
                  ) : null
                }
              />
            </>
          )}
        </View>
      )}

      {/* TAB DOKTER */}
      {activeTab === 'dokter' && (
        <View style={styles.tabContent}>
          {loadingDocs ? (
            <LoadingState fullscreen label="Memuat data dokter…" />
          ) : (
            <>
              {!!doctorErrorMsg && (
                <View style={styles.bannerWrap}>
                  <ErrorState message={doctorErrorMsg} onRetry={loadDoctors} />
                </View>
              )}
              <FlatList
                data={filteredDoctors}
                keyExtractor={(item) => item.id}
                renderItem={renderDoctor}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingDocs}
                    onRefresh={() => {
                      setRefreshingDocs(true);
                      loadDoctors();
                    }}
                    tintColor={COLORS.doctorPrimary}
                  />
                }
                ListEmptyComponent={
                  !doctorErrorMsg ? (
                    <EmptyState
                      icon="medkit-outline"
                      title={
                        searchDoctor
                          ? 'Dokter tidak ditemukan'
                          : 'Belum ada dokter terdaftar'
                      }
                      description={
                        searchDoctor
                          ? `Tidak ada hasil untuk "${searchDoctor}".`
                          : 'Tambahkan dokter baru lewat tombol di pojok kanan bawah.'
                      }
                    />
                  ) : null
                }
              />
            </>
          )}
          <TouchableOpacity
            style={styles.fab}
            onPress={openAddDocModal}
            accessibilityRole="button"
            accessibilityLabel="Tambah dokter baru"
          >
            <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL: EDIT PASIEN */}
      <Modal visible={patientModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Detail Pasien</Text>
                <Text style={styles.sheetSubtitle}>
                  Lihat & kelola data pasien
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPatientModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedPatient && (
                <View style={{ gap: SPACING.lg }}>
                  {/* Profile header */}
                  <Card variant="muted" padding="lg">
                    <View style={styles.profileRow}>
                      <View style={styles.profileAvatarPatient}>
                        <Text style={styles.profileAvatarText}>
                          {selectedPatient.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>
                          {selectedPatient.name}
                        </Text>
                        {!!selectedPatient.email && (
                          <Text style={styles.profileSub}>
                            {selectedPatient.email}
                          </Text>
                        )}
                        <Text style={styles.profileSub}>
                          {selectedPatient.appointmentCount} total kunjungan
                        </Text>
                      </View>
                    </View>
                  </Card>

                  {/* Info detail */}
                  <Card variant="default" padding="none">
                    <SheetInfoRow
                      icon="finger-print-outline"
                      label="ID Pasien"
                      value={selectedPatient.id}
                    />
                    <View style={styles.sheetDivider} />
                    <SheetInfoRow
                      icon="calendar-outline"
                      label="Kunjungan Terakhir"
                      value={selectedPatient.lastDate?.split(' | ')[0] || '—'}
                    />
                    <View style={styles.sheetDivider} />
                    <SheetInfoRow
                      icon="git-merge-outline"
                      label="Status Terakhir"
                      value={selectedPatient.lastStatus}
                    />
                  </Card>

                  {/* Edit Name */}
                  <View>
                    <InputField
                      label="Edit Nama Pasien"
                      icon="person-outline"
                      placeholder="Nama lengkap pasien"
                      value={editPatientName}
                      onChangeText={setEditPatientName}
                    />
                  </View>

                  {/* Action buttons */}
                  <View style={{ gap: SPACING.sm }}>
                    <Button
                      label="Simpan Perubahan"
                      onPress={handleSavePatient}
                      loading={savingPatient}
                      disabled={savingPatient}
                      variant="primary"
                      icon="checkmark-circle"
                      fullWidth
                    />
                    <Button
                      label="Hapus Riwayat Pasien"
                      onPress={() => handleDeletePatient(selectedPatient)}
                      variant="outline"
                      icon="trash-outline"
                      fullWidth
                      textStyle={{ color: COLORS.danger }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: TAMBAH / EDIT DOKTER */}
      <Modal visible={docModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {isEditingDoc ? 'Edit Profil Dokter' : 'Tambah Dokter Baru'}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {isEditingDoc
                    ? 'Perbarui data dan kelola akun dokter'
                    : 'Buat akun portal untuk dokter baru'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeDocModal}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ gap: SPACING.lg }}>
                {/* Profile preview saat edit */}
                {isEditingDoc && (
                  <Card variant="muted" padding="lg">
                    <View style={styles.profileRow}>
                      <IconBadge icon="medkit" tone="doctor" size="lg" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>
                          {docName || '—'}
                        </Text>
                        <Text style={styles.profileSub}>
                          {docSpec || 'Spesialisasi belum diisi'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                )}

                {/* Form fields */}
                <View style={{ gap: SPACING.md }}>
                  <InputField
                    label="Nama Lengkap (dengan gelar)"
                    icon="person-outline"
                    placeholder="Dr. John Doe, Sp.A"
                    value={docName}
                    onChangeText={setDocName}
                  />
                  <SpecialtySelect
                    value={docSpec}
                    open={specDropdownOpen}
                    onToggle={() => setSpecDropdownOpen((isOpen) => !isOpen)}
                    onSelect={handleSelectSpecialty}
                  />
                  <InputField
                    label="Email Akses Portal"
                    icon="mail-outline"
                    placeholder="dokter@klinik.com"
                    value={isEditingDoc ? inferDoctorEmail(docName) : docEmail}
                    onChangeText={isEditingDoc ? () => {} : setDocEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!isEditingDoc}
                    hint={
                      isEditingDoc
                        ? 'Email akun autentikasi tidak dapat diubah dari UI ini.'
                        : undefined
                    }
                  />
                  {!isEditingDoc && (
                    <InputField
                      label="Password Sementara"
                      icon="lock-closed-outline"
                      placeholder="Min. 6 karakter"
                      value={docPassword}
                      onChangeText={setDocPassword}
                      isPassword
                    />
                  )}
                </View>

                {/* Edit-only actions */}
                {isEditingDoc && (
                  <View>
                    <Text style={styles.sectionTitle}>Aksi Akun</Text>
                    <Card variant="default" padding="none">
                      <DangerActionRow
                        icon="trash-outline"
                        title="Nonaktifkan Profil Dokter"
                        subtitle="Riwayat appointment tetap disimpan"
                        onPress={handleDeleteDoc}
                      />
                    </Card>
                  </View>
                )}

                {/* Submit */}
                <View style={{ gap: SPACING.sm }}>
                  <Button
                    label={
                      isEditingDoc ? 'Simpan Perubahan' : 'Buat Akun Dokter'
                    }
                    onPress={handleSaveDoc}
                    loading={savingDoc}
                    disabled={savingDoc}
                    variant="primary"
                    icon="checkmark-circle"
                    fullWidth
                  />
                  <Button
                    label="Batal"
                    onPress={closeDocModal}
                    variant="ghost"
                    fullWidth
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════
const SheetInfoRow = ({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) => (
  <View style={styles.sheetInfoRow}>
    <Ionicons name={icon} size={18} color={COLORS.textMuted} />
    <View style={{ flex: 1 }}>
      <Text style={styles.sheetInfoLabel}>{label}</Text>
      <Text style={styles.sheetInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

const SpecialtySelect = ({
  value,
  open,
  onToggle,
  onSelect,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (specialty: string) => void;
}) => {
  const currentValue = value.trim();
  const visibleOptions = currentValue && !DOCTOR_SPECIALTIES.includes(currentValue)
    ? [currentValue, ...DOCTOR_SPECIALTIES]
    : DOCTOR_SPECIALTIES;

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.selectLabel}>Spesialisasi / Poli</Text>
      <TouchableOpacity
        style={[styles.selectButton, open && styles.selectButtonActive]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="Pilih spesialisasi dokter"
      >
        <View style={styles.selectIcon}>
          <Ionicons name="medkit-outline" size={18} color={COLORS.adminPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[styles.selectValue, !currentValue && styles.selectPlaceholder]}
            numberOfLines={1}
          >
            {currentValue || 'Pilih spesialisasi dokter'}
          </Text>
          <Text style={styles.selectHint} numberOfLines={1}>
            Pilih dari daftar spesialis yang tersedia
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textMuted}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.selectMenu}>
          <ScrollView
            style={styles.selectMenuScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visibleOptions.map((specialty) => {
              const selected = currentValue === specialty;
              return (
                <TouchableOpacity
                  key={specialty}
                  style={[styles.selectOption, selected && styles.selectOptionActive]}
                  onPress={() => onSelect(specialty)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      selected && styles.selectOptionTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {specialty}
                  </Text>
                  {selected && (
                    <View style={styles.selectCheck}>
                      <Ionicons name="checkmark" size={14} color={COLORS.textOnPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const DangerActionRow = ({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.actionRow}
    onPress={onPress}
    accessibilityRole="button"
  >
    <View style={styles.dangerIcon}>
      <Ionicons name={icon} size={18} color={COLORS.danger} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.actionTitle, { color: COLORS.danger }]}>
        {title}
      </Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
  </TouchableOpacity>
);

// ════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // Segment
  segmentWrap: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  segBtnActive: { backgroundColor: COLORS.adminPrimary },
  segText: {
    ...TYPO.label,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  segTextActive: { color: COLORS.textOnPrimary, fontWeight: '700' },
  countPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  countText: { ...TYPO.caption, fontSize: 11, color: COLORS.textMuted, fontWeight: '700' },
  countTextActive: { color: COLORS.textOnPrimary },

  // Search
  searchWrap: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },

  // Tab content
  tabContent: { flex: 1 },

  // Banners (warning/error)
  bannerWrap: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },

  // List
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.xxl,
    flexGrow: 1,
  },

  // Item Card
  itemCard: { marginBottom: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  itemBody: { flex: 1, gap: 2 },
  itemName: {
    ...TYPO.label,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  itemEmail: {
    ...TYPO.bodySm,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemSubtitle: {
    ...TYPO.bodySm,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: { ...TYPO.caption, fontSize: 12, color: COLORS.textMuted },
  metaDot: { ...TYPO.caption, color: COLORS.textDisabled },
  statusDot: { width: 7, height: 7, borderRadius: 4 },

  // Avatar (custom — IconBadge tidak punya text variant)
  avatarPatient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.adminPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPO.h3,
    fontSize: 20,
    color: COLORS.adminPrimary,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: LAYOUT.bottomSafeGap + 16,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.adminPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.adminPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  // Bottom sheet
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  bottomSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  sheetTitle: { ...TYPO.h2, color: COLORS.textPrimary },
  sheetSubtitle: { ...TYPO.bodySm, color: COLORS.textMuted, marginTop: 2 },

  // Sheet profile section
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  profileAvatarPatient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.adminPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    ...TYPO.h2,
    fontSize: 22,
    color: COLORS.adminPrimary,
    fontWeight: '700',
  },
  profileName: { ...TYPO.label, fontSize: 17, color: COLORS.textPrimary, fontWeight: '700' },
  profileSub: { ...TYPO.bodySm, color: COLORS.textMuted, marginTop: 2 },

  // Specialty select
  selectWrap: { gap: 6 },
  selectLabel: {
    ...TYPO.label,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  selectButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  selectButtonActive: {
    borderColor: COLORS.adminPrimary,
    backgroundColor: COLORS.adminPrimaryLight,
  },
  selectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.adminPrimaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectValue: {
    ...TYPO.label,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  selectPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  selectHint: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  selectMenu: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  selectMenuScroll: {
    maxHeight: 264,
  },
  selectOption: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  selectOptionActive: {
    backgroundColor: COLORS.adminPrimaryLight,
  },
  selectOptionText: {
    ...TYPO.bodySm,
    flex: 1,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  selectOptionTextActive: {
    color: COLORS.adminPrimary,
    fontWeight: '700',
  },
  selectCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.adminPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheet info row
  sheetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sheetInfoLabel: { ...TYPO.caption, color: COLORS.textMuted, marginBottom: 2 },
  sheetInfoValue: { ...TYPO.label, fontSize: 14, color: COLORS.textPrimary },
  sheetDivider: { height: 1, backgroundColor: COLORS.borderLight },

  // Section title (sheet)
  sectionTitle: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },

  // Action row (danger)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  dangerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { ...TYPO.label, fontSize: 14, fontWeight: '700' },
  actionSubtitle: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },
});
