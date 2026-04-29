/**
 * DoctorNotificationsScreen — Daftar notifikasi REAL dari Supabase.
 *
 * Konsep:
 *   - Fetch notifications dari tabel `notifications` filtered by recipient_id.
 *   - Realtime subscription: notifikasi baru muncul tanpa refresh.
 *   - Mark as read saat tap → navigate ke detail.
 *   - "Tandai semua dibaca" action di header kalau ada unread.
 *
 * Notifikasi di-generate via trigger Postgres saat appointment events,
 * jadi screen ini READ-ONLY (tidak pernah insert manual).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { COLORS, SPACING, TYPO, LAYOUT } from '../constants/theme';
import {
  ScreenHeader,
  Card,
  IconBadge,
  EmptyState,
  LoadingState,
  ErrorState,
} from '../components/ui';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../../supabase';
import {
  Notification,
  NotificationType,
  fetchMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  formatRelativeTime,
} from '../services/notificationService';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DoctorMain'>;

const TYPE_META: Record<
  NotificationType,
  {
    icon: 'calendar' | 'checkmark-circle' | 'notifications';
    tone: 'info' | 'success' | 'brand';
  }
> = {
  appointment: { icon: 'calendar',         tone: 'info' },
  success:     { icon: 'checkmark-circle', tone: 'success' },
  system:      { icon: 'notifications',    tone: 'brand' },
};

export default function DoctorNotificationsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      setErrorMessage('');
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user.id);
      const list = await fetchMyNotifications(user.id);
      setNotifications(list);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat notifikasi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => loadData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpen = async (item: Notification) => {
    // Optimistic mark-as-read
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        // Tetap navigate; reload akan correct kalau gagal
      }
    }
    navigation.navigate('DoctorNotificationDetail', { notificationId: item.id });
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    Alert.alert(
      'Tandai Semua Dibaca',
      'Tandai semua notifikasi yang belum dibaca sebagai sudah dibaca?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya',
          onPress: async () => {
            try {
              await markAllNotificationsRead(userId);
              loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err.message);
            }
          },
        },
      ]
    );
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          title="Notifikasi"
          variant="back"
          onBack={() => navigation.goBack()}
        />
        <LoadingState fullscreen label="Memuat notifikasi…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Notifikasi"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} notifikasi belum dibaca`
            : 'Semua sudah terbaca'
        }
        variant="back"
        onBack={() => navigation.goBack()}
      />

      {unreadCount > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.markAllBtn}
            accessibilityRole="button"
          >
            <Text style={styles.markAllText}>Tandai semua dibaca</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.errorWrap}>
          <ErrorState message={errorMessage} onRetry={loadData} />
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] || TYPE_META.system;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Card
                variant={item.is_read ? 'outline' : 'accent'}
                accentColor={COLORS.primary}
                padding="md"
                style={{ marginBottom: SPACING.md }}
              >
                <View style={styles.row}>
                  <IconBadge icon={meta.icon} tone={meta.tone} size="md" />
                  <View style={styles.text}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.title,
                          !item.is_read && styles.titleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {!item.is_read && <View style={styles.dot} />}
                    </View>
                    <Text style={styles.message} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={styles.time}>
                      {formatRelativeTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="Belum ada notifikasi"
            description="Notifikasi akan muncul di sini saat ada permintaan konsultasi atau update aktivitas."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  list: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: LAYOUT.bottomSafeGap + SPACING.md,
    flexGrow: 1,
  },

  actionBar: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  markAllBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  markAllText: {
    ...TYPO.label,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  errorWrap: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  text: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    ...TYPO.label,
    color: COLORS.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  titleUnread: { fontWeight: '800' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  message: {
    ...TYPO.bodySm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  time: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 6,
  },
});
