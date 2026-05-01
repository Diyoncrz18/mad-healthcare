import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import { supabase } from '../../supabase';
import { getDefaultBackendUrl, resolveBackendUrl } from '../services/backendUrl';

// ─── Constants ────────────────────────────────────────────────────────────────
/**
 * URL backend proxy. Server-lah yang memanggil Gemini API; client
 * TIDAK PERNAH menyentuh API key. Atur via env Expo:
 *
 *   EXPO_PUBLIC_HEALTHBOT_URL=http://192.168.1.7:4000
 *
 * Default per platform (jika env tidak diset):
 *   - Android (emulator/device): http://10.0.2.2:4000
 *     (10.0.2.2 = host loopback Android emulator. Untuk device fisik
 *      WAJIB pakai EXPO_PUBLIC_HEALTHBOT_URL = http://<IP-LAN-PC>:4000.)
 *   - iOS Simulator / Web:       http://localhost:4000
 */
const DEFAULT_HEALTHBOT_URL = getDefaultBackendUrl();

const HEALTHBOT_URL = resolveBackendUrl(
  (process.env.EXPO_PUBLIC_HEALTHBOT_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_SOCKET_URL as string | undefined),
  DEFAULT_HEALTHBOT_URL
);

// eslint-disable-next-line no-console
console.log('[HealthcareBot] using URL:', HEALTHBOT_URL, 'platform:', Platform.OS);

/** Timeout fetch — server lambat tidak boleh menahan UI selamanya. */
const FETCH_TIMEOUT_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────
type Msg = {
  id: string;
  from: 'user' | 'bot';
  text: string;
};

type ProxyHistoryTurn = { role: 'user' | 'model'; parts: { text: string }[] };

// ─── Component ────────────────────────────────────────────────────────────────
export default function HealthcareBot({ showFab = true }: { showFab?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: "Halo! Saya HealthcareBot \n\nSaya bisa membantu Anda:\n• Menilai gejala awal\n• Menjawab pertanyaan seputar kesehatan\n• Menampilkan daftar dokter kami\n\nApa yang bisa saya bantu hari ini?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // ── Send Message ─────────────────────────────────────
  // Catatan: daftar dokter & system prompt sekarang dibangun di server
  // (lihat `server/src/lib/geminiRouter.js → buildSystemPrompt`).
  // Client hanya mengirim history + message, dengan JWT Supabase
  // sebagai bearer token agar endpoint tidak bisa diakses anonim.
  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: Msg = {
      id: Date.now().toString(),
      from: 'user',
      text: trimmed,
    };

    const snapshot = [...messages];

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Susun riwayat percakapan dengan menggabungkan turn berurutan dari
      // pengirim yang sama (Gemini menolak turn user→user atau model→model).
      const history: ProxyHistoryTurn[] = [];
      let lastRole: 'user' | 'model' | '' = '';

      snapshot.forEach((msg) => {
        if (msg.id === '0') return; // skip greeting awal bot
        const role: 'user' | 'model' = msg.from === 'user' ? 'user' : 'model';
        if (role !== lastRole) {
          history.push({ role, parts: [{ text: msg.text }] });
          lastRole = role;
        } else {
          const last = history[history.length - 1];
          last.parts[0].text += `\n\n${msg.text}`;
        }
      });

      // Ambil access token Supabase untuk autentikasi ke server proxy.
      // Endpoint /chat menolak request tanpa bearer (lihat httpAuth.js).
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('Anda harus login terlebih dahulu untuk memakai HealthcareBot.');
      }

      // Server expects `message` terpisah dari history; system prompt
      // dibangun di server, tidak dapat di-override dari client.
      // Timeout via AbortController — fetch tanpa timeout bisa hang lama
      // bila server tidak menjawab.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${HEALTHBOT_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            history,
            message: trimmed,
          }),
          signal: ctrl.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timer);
        // Bedakan timeout vs network unreachable supaya user tahu cara fix.
        if (fetchErr?.name === 'AbortError') {
          throw new Error(
            `Server HealthcareBot tidak menjawab dalam ${FETCH_TIMEOUT_MS / 1000} dtk.\n\n` +
              `URL: ${HEALTHBOT_URL}\n\n` +
              `Periksa koneksi internet Anda atau hubungi admin.`
          );
        }
        // Network failure umum (server down / URL salah / firewall).
        throw new Error(
          `Tidak dapat terhubung ke server HealthcareBot.\n\n` +
            `URL: ${HEALTHBOT_URL}\n\n` +
            `Kemungkinan penyebab:\n` +
            `• Server backend belum dijalankan\n` +
            `• Alamat URL salah (gunakan IP LAN PC untuk device fisik)\n` +
            `• Tidak ada koneksi internet\n\n` +
            `Silakan hubungi admin.`
        );
      }
      clearTimeout(timer);

      const data = await response.json().catch(() => ({} as any));

      let botText = 'Maaf, terjadi kesalahan saat merespons.';
      if (response.ok && typeof data.reply === 'string' && data.reply.length > 0) {
        botText = data.reply;
      } else if (response.status === 429) {
        botText = 'Anda mengirim pesan terlalu cepat. Mohon tunggu sebentar lalu coba lagi.';
      } else if (response.status === 401) {
        botText = 'Sesi Anda telah berakhir. Silakan login ulang lalu coba lagi.';
      } else if (response.status === 503 && data?.error === 'GEMINI_NOT_CONFIGURED') {
        botText =
          'Server HealthcareBot belum dikonfigurasi (GEMINI_API_KEY belum diisi). ' +
          'Silakan hubungi admin.';
      } else if (data?.error === 'GEMINI_UPSTREAM_ERROR' && data?.status === 403) {
        botText =
          'API Key Gemini ditolak oleh Google (PERMISSION_DENIED).\n\n' +
          'Admin: silakan generate API key baru di https://aistudio.google.com/app/apikey ' +
          'dengan opsi "Create API key in new project", lalu update GEMINI_API_KEY di server/.env.';
      } else if (data?.error === 'GEMINI_TIMEOUT') {
        botText = 'Server Gemini lambat merespons. Silakan coba lagi sebentar.';
      } else if (data?.error) {
        botText = `(${data.error}) ${data.message || ''}`.trim();
      }

      setMessages((m) => [...m, { id: (Date.now() + 1).toString(), from: 'bot', text: botText }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: (Date.now() + 2).toString(),
          from: 'bot',
          text:
            err?.message ||
            'Tidak dapat menghubungi server HealthcareBot. Periksa koneksi atau hubungi admin.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [open, messages.length]);

  // ── Render message item ──────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.from === 'user';
    return (
      <View style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperBot]}>
        {!isUser && (
          <View style={styles.msgAvatar}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
          </View>
        )}
        <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgBot]}>
          <Text style={[styles.msgText, isUser ? styles.msgUserText : styles.msgBotText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={styles.datePillContainer}>
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>Hari ini, {time}</Text>
        </View>
      </View>
    );
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <>
      {showFab && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => setOpen(true)}
          accessibilityLabel="Buka HealthcareBot"
          accessibilityRole="button"
        >
          {/* Outer ring kasih efek “halo” — selapis di belakang.
              Glyph sparkles adalah simbol universal AI di 2025+ */}
          <View style={styles.fabRing} />
          <Ionicons name="sparkles" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerAvatarContainer}>
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.headerTitle}>HealthcareBot</Text>
                <Text style={styles.headerSub}>AI Assistant • Online</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* ── Chat List ── */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={styles.chat}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* ── Input Area ── */}
          <View style={styles.inputContainer}>
            <View style={styles.inputPill}>
              <TextInput
                placeholder="Deskripsikan gejala Anda..."
                placeholderTextColor={COLORS.textDisabled}
                style={styles.input}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
                returnKeyType="send"
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !input.trim() && { backgroundColor: '#A5A5D6' },
                ]}
                onPress={send}
                disabled={!input.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
    elevation: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  // “Halo” ring tipis di luar lingkaran — memberi feel premium &
  // mengarahkan mata ke FAB tanpa harus pakai gradient/animation.
  fabRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: COLORS.primary,
    opacity: 0.25,
  },

  container: { flex: 1, backgroundColor: '#F8F9FE' },

  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: Platform.OS === 'ios' ? 52 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    ...SHADOWS.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...TYPO.h4, color: COLORS.textPrimary },
  headerSub: { ...TYPO.caption, color: COLORS.primary, marginTop: 1, fontWeight: '600' },
  closeBtn: { padding: 6, borderRadius: 20, backgroundColor: COLORS.backgroundAlt },

  chat: { padding: SPACING.xl, paddingBottom: 20 },

  datePillContainer: { alignItems: 'center', marginBottom: SPACING.xl },
  datePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  datePillText: { ...TYPO.caption, color: COLORS.textSecondary },

  msgWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  msgWrapperUser: { justifyContent: 'flex-end' },
  msgWrapperBot: { justifyContent: 'flex-start' },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: COLORS.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: '80%',
    gap: 8,
  },
  msgUser: { backgroundColor: '#5C55ED', borderBottomRightRadius: 4 },
  msgBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...SHADOWS.sm,
  },
  msgText: { ...TYPO.body, lineHeight: 22 },
  msgUserText: { color: '#FFFFFF' },
  msgBotText: { color: COLORS.textPrimary },
  inputContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: '#F8F9FE',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
    shadowOpacity: 0.03,
  },
  input: {
    flex: 1,
    marginHorizontal: 4,
    ...TYPO.body,
    color: COLORS.textPrimary,
    minHeight: 40,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5C55ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
