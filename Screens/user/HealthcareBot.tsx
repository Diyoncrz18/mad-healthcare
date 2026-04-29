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
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO } from '../constants/theme';
import { fetchAllDoctors } from '../services/doctorService';
import { Doctor } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = 'AIzaSyDecHF0YJ3yy-7pC4FYn4ePxc32fVKH1dg';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Types ────────────────────────────────────────────────────────────────────
type Msg = {
  id: string;
  from: 'user' | 'bot';
  text: string;
  imageUri?: string; // local URI for preview
};

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GeminiContent = { role: string; parts: GeminiPart[] };

// ─── Component ────────────────────────────────────────────────────────────────
export default function HealthcareBot({ showFab = true }: { showFab?: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: "Halo! Saya HealthcareBot 🤖\n\nSaya bisa membantu Anda:\n• Menilai gejala awal\n• Menjawab pertanyaan seputar kesehatan\n• Menampilkan daftar dokter kami\n• Menganalisa foto (kirim gambar dengan ikon 📎)\n\nApa yang bisa saya bantu hari ini?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // ── Load doctors once on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchAllDoctors()
      .then(setDoctors)
      .catch(() => {}); // fail silently — bot still works without it
  }, []);

  // ── Build system prompt with live doctor data ────────────────────────────────
  const buildSystemPrompt = (): string => {
    const doctorList =
      doctors.length > 0
        ? doctors
            .map(
              (d, i) =>
                `${i + 1}. ${d.name} — Spesialis ${d.specialty}${d.is_active ? '' : ' (Sedang tidak aktif)'}`
            )
            .join('\n')
        : 'Data dokter belum tersedia.';

    return `Anda adalah asisten medis virtual bernama HealthcareBot untuk klinik CareConnect.

DAFTAR DOKTER DI KLINIK INI (data real-time):
${doctorList}

TUGAS ANDA:
- Bantu pasien menilai gejala awal dan memberikan edukasi medis dasar.
- Jika ditanya siapa saja dokter yang ada, tampilkan daftar di atas beserta spesialisasinya dengan format yang rapi.
- Jika pengguna mengirim gambar, analisa gambar tersebut dari sudut pandang medis (luka, ruam, kondisi kulit, dll.) dan berikan saran awal.
- Selalu ingatkan bahwa saran Anda tidak menggantikan diagnosis dokter yang sesungguhnya.
- Gunakan bahasa yang ramah, profesional, dan mudah dipahami.
- Jika tidak relevan dengan kesehatan, tetap bantu sebaik mungkin namun arahkan kembali ke topik kesehatan.`;
  };

  // ── Image Picker ─────────────────────────────────────────────────────────────
  const pickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permResult.status !== 'granted') {
        const msg = permResult.canAskAgain
          ? 'Aplikasi membutuhkan akses ke galeri foto. Mohon izinkan akses pada dialog berikutnya.'
          : 'Akses galeri telah diblokir. Buka Pengaturan → Aplikasi → Izin → aktifkan akses Foto/Media.';
        Alert.alert('Izin Diperlukan', msg);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressed.base64) {
        Alert.alert('Gagal', 'Tidak dapat memproses gambar ini.');
        return;
      }

      setPendingImage({
        uri: compressed.uri,
        base64: compressed.base64,
        mimeType: 'image/jpeg',
      });
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Terjadi kesalahan saat membuka galeri foto.');
    }
  };

  // ── Send Message (text + optional image) ─────────────────────────────────────
  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed && !pendingImage) return;

    const userMsg: Msg = {
      id: Date.now().toString(),
      from: 'user',
      text: trimmed || '📎 [Gambar dikirim]',
      imageUri: pendingImage?.uri,
    };

    const snapshot = [...messages];
    const img = pendingImage;

    setMessages((m) => [...m, userMsg]);
    setInput('');
    setPendingImage(null);
    setLoading(true);

    try {
      // Build conversation history
      const contents: GeminiContent[] = [];
      let lastRole = '';

      snapshot.forEach((msg) => {
        if (msg.id === '0') return;
        const role = msg.from === 'user' ? 'user' : 'model';
        if (role !== lastRole) {
          contents.push({ role, parts: [{ text: msg.text }] });
          lastRole = role;
        } else {
          const last = contents[contents.length - 1];
          const textPart = last.parts.find((p): p is { text: string } => 'text' in p);
          if (textPart) textPart.text += `\n\n${msg.text}`;
        }
      });

      // Build the new user message parts
      const newParts: GeminiPart[] = [];
      if (img) {
        newParts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
      }
      if (trimmed) {
        newParts.push({ text: trimmed });
      } else if (img) {
        newParts.push({ text: 'Tolong analisa gambar ini dari sudut pandang medis dan berikan saran yang tepat.' });
      }

      if (lastRole === 'user' && !img) {
        const last = contents[contents.length - 1];
        const textPart = last.parts.find((p): p is { text: string } => 'text' in p);
        if (textPart) textPart.text += `\n\n${trimmed}`;
      } else {
        contents.push({ role: 'user', parts: newParts });
      }

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt() }] },
          contents,
        }),
      });

      const data = await response.json();

      let botText = 'Maaf, terjadi kesalahan saat merespons.';
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        botText = data.candidates[0].content.parts[0].text;
      } else if (data.error) {
        botText = `Error: ${data.error.message}`;
      }

      setMessages((m) => [...m, { id: (Date.now() + 1).toString(), from: 'bot', text: botText }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: (Date.now() + 2).toString(),
          from: 'bot',
          text: err.message || 'Gagal terhubung ke Gemini. Periksa koneksi internet Anda.',
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
          <Image source={require('../../assets/robot_avatar.png')} style={styles.msgAvatar} />
        )}
        <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgBot]}>
          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.msgImage}
              resizeMode="cover"
            />
          )}
          {item.text !== '📎 [Gambar dikirim]' && (
            <Text style={[styles.msgText, isUser ? styles.msgUserText : styles.msgBotText]}>
              {item.text}
            </Text>
          )}
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
          onPress={() => setOpen(true)}
          accessibilityLabel="Buka HealthcareBot"
        >
          <Image source={require('../../assets/robot_avatar.png')} style={styles.fabImage} />
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
                <Image source={require('../../assets/robot_avatar.png')} style={styles.headerAvatar} />
              </View>
              <Text style={styles.headerTitle}>HealthcareBot</Text>
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

          {/* ── Pending Image Preview ── */}
          {pendingImage && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: pendingImage.uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.previewRemove} onPress={() => setPendingImage(null)}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.previewLabel}>Gambar siap dikirim</Text>
            </View>
          )}

          {/* ── Input Area ── */}
          <View style={styles.inputContainer}>
            <View style={styles.inputPill}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={pendingImage ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>
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
                  !input.trim() && !pendingImage && { backgroundColor: '#A5A5D6' },
                ]}
                onPress={send}
                disabled={(!input.trim() && !pendingImage) || loading}
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
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
    elevation: 6,
    overflow: 'hidden',
  },
  fabImage: { width: 60, height: 60, borderRadius: 30, resizeMode: 'cover' },

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
    backgroundColor: '#E0E7FF',
    overflow: 'hidden',
  },
  headerAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerTitle: { ...TYPO.h4, color: COLORS.textPrimary },
  headerSub: { ...TYPO.caption, color: COLORS.primary, marginTop: 1 },
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
    backgroundColor: '#E0E7FF',
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
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },

  // Pending image preview strip
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: SPACING.xl,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  previewImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  previewRemove: {
    position: 'absolute',
    left: SPACING.xl + 34,
    top: 4,
  },
  previewLabel: { ...TYPO.caption, color: COLORS.primary, flex: 1 },

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
  attachBtn: { padding: 8 },
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
