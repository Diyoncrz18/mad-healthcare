import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../supabase';
import { COLORS, SPACING } from '../constants/theme';
import {
  ChatComposer,
  ChatHeader,
  DateDivider,
  EmptyState,
  ErrorState,
  LoadingState,
  MessageBubble,
  TypingDots,
  formatDateLabel,
} from '../components/ui';
import { getCurrentUser } from '../services/authService';
import {
  fetchMessages,
  markConversationRead,
  sendMessage as sendMessageRest,
} from '../services/chatService';
import {
  joinConversation,
  leaveConversation,
  markMessagesRead,
  onMessageNew,
  onMessageRead,
  onPresenceUpdate,
  onTyping,
  queryPresence,
  sendMessageRT,
  startTyping,
  stopTyping,
} from '../services/socketService';
import { ChatMessage, UserRole } from '../types';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const formatTime = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const isSameDay = (a: string, b: string): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

/**
 * Item siap-render: pesan biasa, atau separator tanggal,
 * atau placeholder typing indicator.
 */
type RenderItem =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; tail: boolean; showTime: boolean }
  | { kind: 'typing'; key: 'typing' };

/**
 * Bangun struktur render dengan logika:
 *  - Sisipkan DateDivider saat tanggal berubah (atau di paling awal).
 *  - Sembunyikan ekor & jam pada pesan yang berurutan dari sender sama
 *    selama jeda < 5 menit; tampilkan ekor di pesan terakhir grup.
 */
const buildRenderList = (
  messages: ChatMessage[],
  typingByOther: boolean
): RenderItem[] => {
  const out: RenderItem[] = [];
  let lastDateLabel = '';

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const dateLabel = formatDateLabel(m.created_at);
    if (dateLabel && dateLabel !== lastDateLabel) {
      out.push({ kind: 'date', key: `d-${m.id}`, label: dateLabel });
      lastDateLabel = dateLabel;
    }

    const next = messages[i + 1];
    const sameAuthorAsNext =
      next &&
      next.sender_id === m.sender_id &&
      isSameDay(m.created_at, next.created_at) &&
      Math.abs(
        new Date(next.created_at).getTime() - new Date(m.created_at).getTime()
      ) < 5 * 60 * 1000;

    out.push({
      kind: 'message',
      key: m.id,
      message: m,
      // ekor dan jam di pesan terakhir suatu grup saja
      tail: !sameAuthorAsNext,
      showTime: !sameAuthorAsNext,
    });
  }

  if (typingByOther) {
    out.push({ kind: 'typing', key: 'typing' });
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────
type RouteParams = {
  conversationId: string;
  title?: string;
  /** opsional — bisa dikirim dari ChatList agar variant avatar pas */
  contactRole?: 'doctor' | 'user';
  contactUserId?: string;
};

export default function ChatDetailScreen({ navigation, route }: any) {
  const params: RouteParams = route.params || { conversationId: '' };
  const { conversationId, title } = params;
  const listRef = useRef<FlatList<RenderItem>>(null);
  /** Cache ID terakhir yang sudah dikirim ke `markMessagesRead` agar tidak
   *  trigger API call berulang setiap kali state messages berubah. */
  const lastReadAckIdRef = useRef<string | null>(null);
  /** Apakah user sedang dekat ke bawah list — auto-scroll hanya kalau ya. */
  const stickyToBottomRef = useRef(true);

  const [currentUserId, setCurrentUserId] = useState('');
  const [myRole, setMyRole] = useState<UserRole>('user');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [contactUserId, setContactUserId] = useState<string | null>(
    params.contactUserId || null
  );
  const [contactOnline, setContactOnline] = useState(false);
  const [contactTyping, setContactTyping] = useState(false);
  // ── Initial load — pakai useEffect biasa (BUKAN useFocusEffect) supaya
  //    tidak re-fire setiap kali screen di-focus ulang. Kita mau load
  //    sekali per conversationId; update realtime dilakukan oleh socket
  //    listener di useEffect terpisah di bawah.
  //
  //    Tetap expose `loadMessages` untuk tombol Retry di ErrorState.
  const loadMessages = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.log('[ChatDetail] loadMessages start, conversationId=', conversationId);
    try {
      // Guard awal — tanpa conversationId, query Supabase tidak masuk akal.
      if (!conversationId) {
        setErrorMessage('ID percakapan tidak valid. Silakan kembali dan coba lagi.');
        return null;
      }

      setLoading(true);
      setErrorMessage('');

      // Watchdog: kalau Supabase tidak merespons dalam 10 dtk, batalkan
      // agar UI tidak terjebak di "Memuat pesan…". Pasien bisa retry.
      const watchdog = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Koneksi lambat. Periksa internet dan coba lagi.')),
          10_000
        )
      );

      // eslint-disable-next-line no-console
      console.log('[ChatDetail] -> getCurrentUser()');
      const user = await Promise.race([getCurrentUser(), watchdog]);
      if (!user) {
        setErrorMessage('Sesi Anda berakhir. Silakan login ulang.');
        return null;
      }
      const role = (user.user_metadata?.role || 'user') as UserRole;
      setCurrentUserId(user.id);
      setMyRole(role);

      // eslint-disable-next-line no-console
      console.log('[ChatDetail] -> fetchMessages()', { uid: user.id, role });
      const rows = await Promise.race([fetchMessages(conversationId), watchdog]);
      // eslint-disable-next-line no-console
      console.log('[ChatDetail] fetchMessages OK, count=', (rows as ChatMessage[]).length);
      setMessages(rows as ChatMessage[]);
      return { user, role };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn('[ChatDetail] loadMessages FAILED:', err?.message || err);
      setErrorMessage(err?.message || 'Gagal memuat pesan.');
      return null;
    } finally {
      // eslint-disable-next-line no-console
      console.log('[ChatDetail] loadMessages finally → setLoading(false)');
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    loadMessages().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  // ── Resolve siapa lawan bicara (auth.users.id). Terpisah dari load
  //    utama supaya kegagalan resolver TIDAK menahan UI di state loading.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: conv } = await supabase
          .from('chat_conversations')
          .select('patient_id, doctor:doctors!inner(user_id)')
          .eq('id', conversationId)
          .maybeSingle();
        if (cancelled || !conv) return;

        const doctorUserId = (conv as any).doctor?.user_id || null;

        if (!contactUserId) {
          const other = myRole === 'doctor' ? conv.patient_id : doctorUserId;
          if (other) setContactUserId(other);
        }
      } catch {
        /* presence info opsional — abaikan */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, contactUserId, currentUserId, myRole]);

  // ── Join socket room + register listener realtime ─────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await joinConversation(conversationId);
      } catch {
        /* socket bisa offline */
      }
    })();

    const offNew = onMessageNew((payload) => {
      if (!mounted) return;
      if (payload.conversation_id !== conversationId) return;
      setMessages((prev) => {
        // Jika ada placeholder optimistic dengan clientId yang sama, replace.
        if (payload.clientId) {
          const idx = prev.findIndex((m) => m.id === payload.clientId);
          if (idx >= 0) {
            const next = prev.slice();
            next[idx] = { ...payload };
            return next;
          }
        }
        // Hindari duplikasi (id sudah ada)
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
    });

    const offRead = onMessageRead((payload) => {
      if (!mounted) return;
      if (payload.conversationId !== conversationId) return;
      // Hanya pesan yang DIKIRIM oleh pihak lain dari `readerId` yang
      // ditandai read. Pesan dari readerId sendiri tidak diubah.
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender_id === payload.readerId) return m;
          if (m.read_at) return m;
          return { ...m, read_at: payload.readAt };
        })
      );
    });

    const offTyping = onTyping((p) => {
      if (!mounted) return;
      if (p.conversationId !== conversationId) return;
      if (p.userId === currentUserId) return;
      setContactTyping(p.typing);
    });

    const offPresence = onPresenceUpdate((p) => {
      if (!mounted) return;
      if (contactUserId && p.userId === contactUserId) {
        setContactOnline(p.online);
      }
    });

    // Fallback: Supabase realtime untuk pesan kalau socket gateway down.
    const channel = supabase
      .channel(`chat-detail-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (event) => {
          if (!mounted) return;
          const m = event.new as ChatMessage;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (event) => {
          if (!mounted) return;
          const m = event.new as ChatMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      offNew();
      offRead();
      offTyping();
      offPresence();
      leaveConversation(conversationId).catch(() => undefined);
      supabase.removeChannel(channel);
    };
  }, [conversationId, contactUserId, currentUserId]);

  // ── Query presence awal sekali saja ──
  useEffect(() => {
    if (!contactUserId) return;
    queryPresence([contactUserId])
      .then((resp) => {
        if (resp.ok && resp.presence) {
          setContactOnline(!!resp.presence[contactUserId]);
        }
      })
      .catch(() => undefined);
  }, [contactUserId]);

  // ── Otomatis tandai pesan masuk sebagai sudah dibaca ──────────
  //    Pakai cache ref untuk dedup: kirim 1x per ID terbaru.
  useEffect(() => {
    if (!currentUserId || messages.length === 0) return;
    let lastFromOther: ChatMessage | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id !== currentUserId) {
        lastFromOther = messages[i];
        break;
      }
    }
    if (!lastFromOther || lastFromOther.read_at) return;
    if (lastReadAckIdRef.current === lastFromOther.id) return;
    lastReadAckIdRef.current = lastFromOther.id;

    // Pakai socket dulu, fallback ke REST.
    markMessagesRead(conversationId, lastFromOther.id)
      .then((r) => {
        if (!r.ok) return markConversationRead(conversationId);
      })
      .catch(() => markConversationRead(conversationId).catch(() => undefined));
  }, [conversationId, currentUserId, messages]);

  // ── Send (optimistic + socket dengan REST fallback) ───────────
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft('');

    // Saat user kirim, paksa sticky-to-bottom — wajar lompat ke pesan baru.
    stickyToBottomRef.current = true;

    // Optimistic message
    const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessage = {
      id: clientId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      message: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const resp = await sendMessageRT(conversationId, text, clientId);
      if (!resp.ok) {
        // fallback REST
        await sendMessageRest(conversationId, text);
        // hapus optimistic — supabase realtime akan mendorong yang asli
        setMessages((prev) => prev.filter((m) => m.id !== clientId));
      }
      // bila ok, server akan emit `message:new` dengan id asli — handler di atas mengganti placeholder.
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== clientId));
      Alert.alert('Gagal mengirim pesan', err.message || 'Silakan coba lagi.');
    } finally {
      setSending(false);
      stopTyping(conversationId).catch(() => undefined);
    }
  };

  const handleTyping = (typing: boolean) => {
    (typing ? startTyping(conversationId) : stopTyping(conversationId)).catch(
      () => undefined
    );
  };

  // ── Render data
  const renderItems = useMemo(
    () => buildRenderList(messages, contactTyping),
    [messages, contactTyping]
  );

  const renderItem = ({ item }: { item: RenderItem }) => {
    if (item.kind === 'date') return <DateDivider label={item.label} />;
    if (item.kind === 'typing') return <TypingDots label={`${title || 'Lawan'} sedang mengetik`} />;
    const m = item.message;
    const mine = m.sender_id === currentUserId;
    const readState: 'sent' | 'read' | undefined = mine
      ? m.read_at
        ? 'read'
        : 'sent'
      : undefined;
    return (
      <MessageBubble
        text={m.message}
        mine={mine}
        time={formatTime(m.created_at)}
        tail={item.tail}
        showTime={item.showTime}
        readState={readState}
      />
    );
  };

  // Variant avatar berdasarkan role lawan bicara.
  const headerVariant: 'patient' | 'doctor' =
    myRole === 'doctor' ? 'patient' : 'doctor';

  // ❗ Render header SELALU (termasuk saat loading/error) supaya user
  //    selalu bisa menekan tombol Back. Body-nya saja yang berubah.
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.surface}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        // iOS pakai 'padding' supaya composer naik dengan keyboard.
        // Android pakai 'height' untuk shrink area di atas keyboard
        // (kombinasi dengan softwareKeyboardLayoutMode='resize' di app.json
        // membuat input box tidak tertutup keyboard).
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ChatHeader
          name={title || 'Chat'}
          subtitle={myRole === 'doctor' ? 'Pasien' : 'Dokter'}
          online={contactOnline}
          typing={contactTyping}
          variant={headerVariant}
          onBack={() => navigation.goBack()}
        />

        {loading ? (
          <LoadingState fullscreen label="Memuat pesan…" />
        ) : (
          <>
            {!!errorMessage && (
              <ErrorState
                message={errorMessage}
                onRetry={loadMessages}
                style={styles.error}
              />
            )}

            <FlatList
              ref={listRef}
              data={renderItems}
              keyExtractor={(item) => item.key}
              renderItem={renderItem}
              contentContainerStyle={styles.messages}
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                const distanceFromBottom =
                  contentSize.height - layoutMeasurement.height - contentOffset.y;
                stickyToBottomRef.current = distanceFromBottom < 80;
              }}
              scrollEventThrottle={64}
              onContentSizeChange={() => {
                if (stickyToBottomRef.current) {
                  listRef.current?.scrollToEnd({ animated: false });
                }
              }}
              ListEmptyComponent={
                <EmptyState
                  icon="chatbubble-ellipses-outline"
                  title="Belum ada pesan"
                  description="Kirim pesan pertama untuk memulai percakapan."
                  style={styles.empty}
                />
              }
            />

            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              onTyping={handleTyping}
              disabled={sending}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  error: { marginHorizontal: SPACING.xl, marginTop: SPACING.md },
  messages: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  empty: {
    marginTop: SPACING.xxxl,
    paddingVertical: SPACING.xxxl,
  },
});
