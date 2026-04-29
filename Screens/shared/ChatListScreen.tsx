import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { getCurrentUser } from '../services/authService';
import { COLORS, SPACING, TYPO, RADIUS, SHADOWS } from '../constants/theme';
import { Card, EmptyState, LoadingState } from '../components/ui';

type ChatContact = {
  id: string; // The user_id of the other person (patient or doctor)
  name: string;
  role: 'doctor' | 'patient';
  doctor_id?: string; // If the contact is a doctor, keep their doctor_id for reference
};

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'user' | 'doctor' | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) return;
      setCurrentUser(user);
      
      const role = user.user_metadata?.role || 'user';
      setUserRole(role);

      let fetchedContacts: ChatContact[] = [];

      if (role === 'user') {
        // Patient: get doctors from appointments
        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('doctor_id, doctor_name, doctors(user_id)')
          .eq('user_id', user.id)
          .in('status', ['pending', 'Confirmed', 'Selesai']);
          
        if (error) throw error;
        
        const uniqueDoctors = new Map<string, ChatContact>();
        appointments?.forEach(app => {
          // ensure doctors.user_id exists
          const docUserId = app.doctors?.user_id;
          if (docUserId && !uniqueDoctors.has(docUserId)) {
            uniqueDoctors.set(docUserId, {
              id: docUserId,
              name: app.doctor_name,
              role: 'doctor',
              doctor_id: app.doctor_id
            });
          }
        });
        fetchedContacts = Array.from(uniqueDoctors.values());
      } else if (role === 'doctor') {
        // Doctor: get patients from appointments
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (doctorData) {
          const { data: appointments, error } = await supabase
            .from('appointments')
            .select('user_id, patient_name')
            .eq('doctor_id', doctorData.id)
            .in('status', ['pending', 'Confirmed', 'Selesai']);
            
          if (error) throw error;
          
          const uniquePatients = new Map<string, ChatContact>();
          appointments?.forEach(app => {
            if (app.user_id && !uniquePatients.has(app.user_id)) {
              uniquePatients.set(app.user_id, {
                id: app.user_id,
                name: app.patient_name,
                role: 'patient'
              });
            }
          });
          fetchedContacts = Array.from(uniquePatients.values());
        }
      }

      setContacts(fetchedContacts);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadContacts(); }, [loadContacts]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
         <LoadingState fullscreen label="Memuat kontak..." />
      </SafeAreaView>
    );
  }

  const handlePressContact = (contact: ChatContact) => {
    navigation.navigate('ChatRoom', { contactId: contact.id, contactName: contact.name, contactRole: contact.role });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pesan</Text>
        <Text style={styles.headerSub}>
          {userRole === 'user' ? 'Konsultasi dengan dokter Anda' : 'Pesan dari pasien Anda'}
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyWrap}>
           <EmptyState
             icon="chatbubbles-outline"
             title="Belum Ada Obrolan"
             description={
               userRole === 'user' 
               ? "Anda belum memiliki daftar dokter. Buat janji temu terlebih dahulu untuk mulai chat."
               : "Belum ada pasien yang membuat janji temu dengan Anda."
             }
           />
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => handlePressContact(item)}>
              <View style={styles.avatar}>
                <Ionicons name={item.role === 'doctor' ? 'medkit' : 'person'} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.roleLabel}>{item.role === 'doctor' ? 'Dokter' : 'Pasien'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { ...TYPO.h1, color: COLORS.textPrimary },
  headerSub: { ...TYPO.body, color: COLORS.textMuted, marginTop: 4 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  listContent: { padding: SPACING.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  info: { flex: 1, gap: 2 },
  name: { ...TYPO.h4, color: COLORS.textPrimary },
  roleLabel: { ...TYPO.caption, color: COLORS.primary },
});
