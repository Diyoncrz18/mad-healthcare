import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../supabase';
import { COLORS, LAYOUT, RADIUS, SPACING, TYPO } from '../constants/theme';
import { getCurrentUser } from '../services/authService';
import {
  fetchChatContacts,
  fetchConversations,
  getCurrentDoctorProfile,
  getOrCreateConversation,
} from '../services/chatService';
import {
  getSocket,
  onConversationBump,
  onPresenceUpdate,
  queryPresence,
} from '../services/socketService';
import { ChatContact, ChatConversationListItem, UserRole } from '../types';
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
  UnreadBadge,
} from '../components/ui';

/**
 * Format jam relatif:
 *  - hari yang sama  → "13:42"
 *  - kemarin         → "Kemarin"
 *  - <7 hari         → "Sen", "Sel", …
 *  - lebih lama      → "12 Apr"
 */
const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Kemarin';
  }
  const diff = now.getTime() - d.getTime();
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString('id-ID', { weekday: 'short' });
  }
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

export default function ChatListScreen({ navigation }: any) {
  const [role, setRole] = useState<UserRole>('user');
  const [userId, setUserId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [conversations, setConversations] = useState<ChatConversationListItem[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingChatId, setStartingChatId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Hindari `doctorId` di dependency — function ini selalu mengambil
  // doctorId terbaru dari DB ketika role=doctor, lalu sinkronkan state.
  // Jika kita masukkan `doctorId` ke deps, setDoctorId di dalam akan
  // me-rebuild loadData → memicu useFocusEffect/useEffect tergantung,
  // menghasilkan refetch berulang.
  const loadData = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[ChatList] loadData start');
    try {
      setErrorMessage('');

      // Watchdog 12 dtk — paksa keluar dari loading kalau Supabase hang.
      const watchdog = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Koneksi lambat. Periksa internet dan coba lagi.')),
          12_000
        )
      );

      const user = await Promise.race([getCurrentUser(), watchdog]);
      if (!user) {
        // eslint-disable-next-line no-console
        console.warn('[ChatList] no user — skipping');
        return;
      }

      const userRole = (user.user_metadata?.role || 'user') as UserRole;
      // eslint-disable-next-line no-console
      console.log('[ChatList] user', { uid: user.id, role: userRole });
      setRole(userRole);
      setUserId(user.id);

      if (userRole === 'doctor') {
        // eslint-disable-next-line no-console
        console.log('[ChatList] -> getCurrentDoctorProfile()');
        const doctor = await Promise.race([getCurrentDoctorProfile(), watchdog]);
        // eslint-disable-next-line no-console
        console.log('[ChatList] doctor profile', doctor ? doctor.id : '(none)');
        setDoctorId(doctor?.id || '');
      }

      // eslint-disable-next-line no-console
      console.log('[ChatList] -> fetchConversations + fetchChatContacts');
      const [conversationRows, contactRows] = await Promise.race([
        Promise.all([fetchConversations(userRole), fetchChatContacts(userRole)]),
        watchdog,
      ]);
      // eslint-disable-next-line no-console
      console.log('[ChatList] data loaded', {
        conversations: conversationRows.length,
        contacts: contactRows.length,
      });
      setConversations(conversationRows);
      setContacts(contactRows);

      // ── Tanyakan presence dari socket gateway — NON-BLOCKING ──
      //    UI list utama tidak boleh menunggu socket yang lambat/offline.
      //    Hasil presence akan tampil kemudian (online dot di avatar).
      const ids = Array.from(
        new Set(
          [
            ...conversationRows.map((c) => c.contactUserId).filter(Boolean) as string[],
            ...contactRows.map((c) => c.userId),
          ]
        )
      );
      if (ids.length) {
        queryPresence(ids)
          .then((resp) => {
            if (resp.ok && resp.presence) setPresenceMap(resp.presence);
          })
          .catch(() => undefined);
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('[ChatList] loadData failed:', err?.message || err);
      setErrorMessage(err.message || 'Gagal memuat chat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // ── Realtime: prefer Socket.IO `conversation:bump` untuk update lokal
  //    cepat tanpa full refetch. Supabase realtime hanya dipakai sebagai
  //    cadangan kalau socket gateway down (debounced loadData). ──
  useEffect(() => {
    let mounted = true;

    // Update state lokal dari payload bump → tidak perlu refetch list/contacts.
    const offBump = onConversationBump((p) => {
      if (!mounted) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === p.conversationId);
        if (idx < 0) {
          // Conversation baru (mis. dokter pertama kali membalas); refetch
          // sekali untuk menarik baris lengkap (contact name, dsb).
          loadData();
          return prev;
        }
        const current = prev[idx];
        const isMine = p.senderId === userId;
        const next: ChatConversationListItem = {
          ...current,
          lastMessage: p.lastMessage,
          lastMessageAt: p.lastMessageAt,
          lastSenderId: p.senderId,
          updated_at: p.lastMessageAt,
          unreadCount: isMine ? current.unreadCount : (current.unreadCount || 0) + 1,
        };
        // Move ke atas (urutan by updated_at desc).
        const without = prev.slice(0, idx).concat(prev.slice(idx + 1));
        return [next, ...without];
      });
    });
    const offPresence = onPresenceUpdate((p) => {
      if (!mounted) return;
      setPresenceMap((prev) => ({ ...prev, [p.userId]: p.online }));
    });

    // Pastikan koneksi socket dicoba (lazy auto-connect).
    getSocket().catch(() => undefined);

    // Debounce loadData supaya burst event Supabase realtime tidak memicu
    // banyak refetch beruntun (mis. saat batch insert dari migrasi).
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (!mounted) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mounted) loadData();
      }, 400);
    };

    const channel = supabase
      .channel('chat-list-fallback')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_conversations' },
        debouncedLoad
      )
      .subscribe();

    return () => {
      mounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      offBump();
      offPresence();
      supabase.removeChannel(channel);
    };
  }, [loadData, userId]);

  const contactIdsWithConversation = useMemo(() => {
    return new Set(
      conversations.map((conversation) => (
        role === 'doctor' ? conversation.patient_id : conversation.doctor_id
      ))
    );
  }, [conversations, role]);

  const availableContacts = useMemo(() => (
    contacts.filter((contact) => !contactIdsWithConversation.has(contact.id))
  ), [contacts, contactIdsWithConversation]);

  const openConversation = (conversation: ChatConversationListItem) => {
    navigation.navigate('ChatDetail', {
      conversationId: conversation.id,
      title: conversation.contactName,
    });
  };

  const startConversation = async (contact: ChatContact) => {
    try {
      setStartingChatId(contact.id);
      const patientId = role === 'doctor' ? contact.userId : userId;
      const targetDoctorId = role === 'doctor' ? doctorId : contact.id;

      const conversation = await getOrCreateConversation(patientId, targetDoctorId);
      navigation.navigate('ChatDetail', {
        conversationId: conversation.id,
        title: contact.name,
      });
      loadData();
    } catch (err: any) {
      Alert.alert('Gagal membuka chat', err.message || 'Silakan coba lagi.');
    } finally {
      setStartingChatId('');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderConversation = ({ item }: { item: ChatConversationListItem }) => {
    const online = !!(item.contactUserId && presenceMap[item.contactUserId]);
    const unread = item.unreadCount || 0;
    const isMine = item.lastSenderId && item.lastSenderId === userId;
    const previewPrefix = isMine ? 'Anda: ' : '';
    const preview = item.lastMessage
      ? `${previewPrefix}${item.lastMessage}`
      : 'Belum ada pesan. Mulai percakapan sekarang.';
    const avatarVariant = role === 'doctor' ? 'patient' : 'doctor';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openConversation(item)}
        style={styles.listItem}
      >
        <Avatar
          name={item.contactName}
          size={52}
          variant={avatarVariant}
          online={online}
        />
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, unread > 0 && styles.nameUnread]}
              numberOfLines={1}
            >
              {item.contactName}
            </Text>
            <Text
              style={[styles.time, unread > 0 && styles.timeUnread]}
            >
              {formatRelativeTime(item.lastMessageAt || item.updated_at)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text
              style={[
                styles.preview,
                unread > 0 && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {preview}
            </Text>
            <UnreadBadge count={unread} style={styles.unread} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContact = ({ item }: { item: ChatContact }) => {
    const isStarting = startingChatId === item.id;
    const online = !!presenceMap[item.userId];
    const avatarVariant = item.role === 'doctor' ? 'doctor' : 'patient';
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!!startingChatId}
        onPress={() => startConversation(item)}
        style={styles.contactItem}
      >
        <Avatar name={item.name} size={44} variant={avatarVariant} online={online} />
        <View style={styles.rowText}>
          <Text
            style={styles.name}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <View style={styles.subRow}>
            <Ionicons
              name={item.role === 'doctor' ? 'medkit-outline' : 'person-outline'}
              size={12}
              color={COLORS.textMuted}
            />
            <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
          </View>
        </View>
        <View style={styles.startBtn}>
          <Text style={styles.startText}>
            {isStarting ? 'Membuka…' : 'Chat'}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState fullscreen label="Memuat chat…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="Chat"
              subtitle={role === 'doctor'
                ? 'Hubungi pasien dan balas percakapan masuk.'
                : 'Hubungi dokter dari daftar kontak klinik.'}
              style={styles.header}
            />
            {!!errorMessage && (
              <ErrorState message={errorMessage} onRetry={loadData} style={styles.block} />
            )}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Percakapan</Text>
              {conversations.length > 0 && (
                <Text style={styles.sectionMeta}>{conversations.length} aktif</Text>
              )}
            </View>
            {conversations.length === 0 && (
              <EmptyState
                icon="chatbubbles-outline"
                title="Belum ada percakapan"
                description="Pilih kontak di bawah untuk memulai chat."
                style={styles.empty}
              />
            )}
          </>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Mulai chat baru</Text>
              {availableContacts.length > 0 && (
                <Text style={styles.sectionMeta}>{availableContacts.length} kontak</Text>
              )}
            </View>
            {availableContacts.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="Tidak ada kontak baru"
                description="Semua kontak tersedia sudah ada di percakapan Anda."
                style={styles.empty}
              />
            ) : (
              <FlatList
                data={availableContacts}
                keyExtractor={(item) => item.id}
                renderItem={renderContact}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                scrollEnabled={false}
              />
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    paddingBottom: LAYOUT.bottomSafeGap,
  },
  header: { paddingBottom: SPACING.sm },
  block: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionTitle: { ...TYPO.h3, color: COLORS.textPrimary },
  sectionMeta: { ...TYPO.caption, color: COLORS.textMuted },

  // Item list percakapan
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  rowText: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  name: { ...TYPO.label, color: COLORS.textPrimary, flex: 1 },
  nameUnread: { ...TYPO.h4, color: COLORS.textPrimary, flex: 1 },
  time: { ...TYPO.caption, color: COLORS.textMuted },
  timeUnread: { color: COLORS.primary, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  preview: { ...TYPO.bodySm, color: COLORS.textMuted, flex: 1 },
  previewUnread: { color: COLORS.textSecondary, fontWeight: '600' },
  unread: { marginLeft: SPACING.xs },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginLeft: SPACING.xl + 52 + SPACING.md,
  },

  // Item kontak baru
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subtitle: { ...TYPO.caption, color: COLORS.textMuted },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryLight,
  },
  startText: { ...TYPO.labelSm, color: COLORS.primary },

  // Empty
  empty: {
    marginHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
  },
  footer: { marginTop: SPACING.lg },
});
