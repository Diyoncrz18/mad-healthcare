/**
 * EditProfileScreen — Edit Profil (Shared semua role)
 *
 * Form edit untuk:
 *   - Patient/Admin → Nama, Telepon (saved ke user_metadata)
 *   - Doctor → Nama, Telepon, Spesialisasi (saved ke doctors table + metadata)
 *
 * Email read-only (perlu Supabase auth flow untuk diubah).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import { UserRole } from '../types';
import {
  ScreenHeader,
  Card,
  Button,
  InputField,
  LoadingState,
  InfoBanner,
} from '../components/ui';

export default function EditProfileScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; specialty?: string }>({});

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        const userRole = (user.user_metadata?.role || 'user') as UserRole;
        const meta = user.user_metadata || {};

        setRole(userRole);
        setEmail(user.email || '');
        setName((meta.display_name as string) || (meta.name as string) || '');
        setPhone((meta.phone as string) || '');

        if (userRole === 'doctor') {
          const { data } = await supabase
            .from('doctors')
            .select('id, name, specialty')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data) {
            setDoctorId(data.id);
            setName(data.name || '');
            setSpecialty(data.specialty || '');
          }
        }
      } catch (err) {
        console.error('Load profile failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Nama tidak boleh kosong.';
    if (role === 'doctor' && !specialty.trim()) {
      next.specialty = 'Spesialisasi wajib diisi.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Update user_metadata (semua role)
      const { error: metaError } = await supabase.auth.updateUser({
        data: { display_name: name.trim(), phone: phone.trim() },
      });
      if (metaError) throw metaError;

      // Sync ke doctors table jika dokter
      if (role === 'doctor' && doctorId) {
        const { error: docError } = await supabase
          .from('doctors')
          .update({ name: name.trim(), specialty: specialty.trim() })
          .eq('id', doctorId);
        if (docError) throw docError;
      }

      Alert.alert('Tersimpan', 'Profil Anda berhasil diperbarui.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan tak terduga.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat profil…" />
      </SafeAreaView>
    );
  }

  const initial = (name || email || '?').charAt(0).toUpperCase();
  const roleLabel =
    role === 'doctor' ? 'Dokter' : role === 'admin' ? 'Administrator' : 'Pasien';
  const roleIcon =
    role === 'doctor' ? 'medkit' : role === 'admin' ? 'shield-checkmark' : 'person';

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Edit Profil"
        variant="back"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            {/* Avatar Hero */}
            <View style={styles.heroWrap}>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.avatarBadge}>
                  <Ionicons name={roleIcon as any} size={14} color={COLORS.surface} />
                </View>
              </View>
              <Text style={styles.heroName} numberOfLines={1}>
                {name || 'Tanpa Nama'}
              </Text>
              <Text style={styles.heroRole}>{roleLabel}</Text>
            </View>

            <InfoBanner
              tone="info"
              title="Tip Profil Lengkap"
              message="Profil yang lengkap memudahkan klinik menghubungi Anda saat dibutuhkan."
              icon="information-circle"
            />

            {/* Form Card */}
            <Card variant="default" padding="lg">
              <View style={styles.form}>
                <InputField
                  label="Nama Lengkap"
                  icon="person-outline"
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (errors.name) setErrors({ ...errors, name: undefined });
                  }}
                  errorText={errors.name}
                />

                <InputField
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  editable={false}
                  hint="Email tidak dapat diubah dari sini."
                  rightSlot={
                    <Ionicons
                      name="lock-closed"
                      size={16}
                      color={COLORS.textMuted}
                      style={{ marginLeft: SPACING.xs }}
                    />
                  }
                />

                <InputField
                  label="Nomor Telepon"
                  icon="call-outline"
                  placeholder="Contoh: 0812-3456-7890"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  hint="Opsional. Akan digunakan untuk konfirmasi cepat."
                />

                {role === 'doctor' && (
                  <InputField
                    label="Spesialisasi"
                    icon="medkit-outline"
                    placeholder="Contoh: Poli Anak, Poli Gigi"
                    value={specialty}
                    onChangeText={(t) => {
                      setSpecialty(t);
                      if (errors.specialty) setErrors({ ...errors, specialty: undefined });
                    }}
                    errorText={errors.specialty}
                  />
                )}
              </View>
            </Card>
          </View>
        </ScrollView>

        {/* Sticky Save Bar */}
        <View style={styles.bottomBar}>
          <Button
            label={saving ? 'Menyimpan…' : 'Simpan Perubahan'}
            onPress={handleSave}
            loading={saving}
            size="lg"
            icon="checkmark"
            iconPosition="right"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: 100 },
  body: { paddingHorizontal: SPACING.xl, gap: SPACING.lg },

  // Hero
  heroWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: 4,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    position: 'relative',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...TYPO.display,
    color: COLORS.primary,
    fontSize: 36,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  heroName: { ...TYPO.h2, color: COLORS.textPrimary },
  heroRole: { ...TYPO.label, color: COLORS.primary },

  // Form
  form: { gap: SPACING.lg },

  // Bottom bar
  bottomBar: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? SPACING.lg : SPACING.xl,
    borderTopWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.lg,
  },
});
