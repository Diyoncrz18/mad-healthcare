/**
 * Chat UI Kit — komponen kecil yang dipakai berulang oleh
 * ChatListScreen dan ChatDetailScreen. Semua memakai design tokens
 * (`COLORS`, `SPACING`, `RADIUS`, `TYPO`, `SHADOWS`) sehingga
 * presentasi konsisten dengan sisa aplikasi.
 *
 * Komponen yang diekspor:
 *  - Avatar         : monogram bulat dengan opsi online dot.
 *  - OnlineDot      : titik kecil indikator presence.
 *  - UnreadBadge    : pil angka pesan belum dibaca.
 *  - DateDivider    : pembatas tanggal "Hari ini", "Kemarin", "12 Apr".
 *  - MessageBubble  : bubble pesan dengan ekor & status read receipt.
 *  - TypingDots     : indikator "lawan sedang mengetik" (3 titik animasi).
 *  - ChatHeader     : header layar detail chat (avatar + nama + status).
 *  - ChatComposer   : input + tombol kirim.
 */
import React, { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPO } from '../../constants/theme';

// ═══════════════════════════════════════════════════════════════════
// Avatar + OnlineDot
// ═══════════════════════════════════════════════════════════════════
interface AvatarProps {
  name: string;
  size?: number;
  online?: boolean;
  variant?: 'patient' | 'doctor';
  style?: StyleProp<ViewStyle>;
}

const initialsOf = (name: string): string => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const Avatar = ({ name, size = 48, online, variant = 'doctor', style }: AvatarProps) => {
  const ring = variant === 'patient' ? COLORS.patientPrimaryLight : COLORS.doctorPrimaryLight;
  const text = variant === 'patient' ? COLORS.patientPrimary : COLORS.doctorPrimary;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          chatStyles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: ring,
          },
        ]}
      >
        <Text style={[chatStyles.avatarText, { color: text, fontSize: size * 0.36 }]}>
          {initialsOf(name)}
        </Text>
      </View>
      {online !== undefined && (
        <OnlineDot online={online} style={chatStyles.avatarDot} />
      )}
    </View>
  );
};

interface OnlineDotProps {
  online: boolean;
  style?: StyleProp<ViewStyle>;
  size?: number;
}
export const OnlineDot = ({ online, style, size = 12 }: OnlineDotProps) => (
  <View
    style={[
      chatStyles.dot,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: online ? COLORS.success : COLORS.textDisabled,
      },
      style,
    ]}
  />
);

// ═══════════════════════════════════════════════════════════════════
// UnreadBadge
// ═══════════════════════════════════════════════════════════════════
interface UnreadBadgeProps {
  count: number;
  style?: StyleProp<ViewStyle>;
}
export const UnreadBadge = ({ count, style }: UnreadBadgeProps) => {
  if (!count) return null;
  return (
    <View style={[chatStyles.badge, style]}>
      <Text style={chatStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// DateDivider
// ═══════════════════════════════════════════════════════════════════
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatDateLabel = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return 'Hari ini';
  if (isSameDay(d, yesterday)) return 'Kemarin';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

interface DateDividerProps {
  label: string;
}
export const DateDivider = ({ label }: DateDividerProps) => (
  <View style={chatStyles.dividerRow}>
    <View style={chatStyles.dividerLine} />
    <View style={chatStyles.dividerPill}>
      <Text style={chatStyles.dividerText}>{label}</Text>
    </View>
    <View style={chatStyles.dividerLine} />
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// MessageBubble
// ═══════════════════════════════════════════════════════════════════
interface MessageBubbleProps {
  text: string;
  mine: boolean;
  time: string;
  /** Tampilkan ekor (tail) di sudut bawah bubble — set false saat pesan
   *  ini bagian dari rangkaian pesan beruntun dengan pengirim sama. */
  tail?: boolean;
  /** Indikator read receipt (hanya untuk pesan saya). */
  readState?: 'sent' | 'read';
  /** Tampilkan jam (di akhir grup pesan beruntun saja). */
  showTime?: boolean;
}

export const MessageBubble = ({
  text,
  mine,
  time,
  tail = true,
  readState,
  showTime = true,
}: MessageBubbleProps) => {
  const tailRadius: ViewStyle = tail
    ? mine
      ? { borderBottomRightRadius: RADIUS.sm }
      : { borderBottomLeftRadius: RADIUS.sm }
    : {};

  return (
    <View style={[chatStyles.row, mine ? chatStyles.rowMine : chatStyles.rowTheirs]}>
      <View
        style={[
          chatStyles.bubble,
          mine ? chatStyles.bubbleMine : chatStyles.bubbleTheirs,
          tailRadius,
        ]}
      >
        <Text
          style={[
            chatStyles.bubbleText,
            mine ? chatStyles.bubbleTextMine : chatStyles.bubbleTextTheirs,
          ]}
        >
          {text}
        </Text>
        {showTime && (
          <View style={chatStyles.metaRow}>
            <Text
              style={[
                chatStyles.metaTime,
                mine ? chatStyles.metaTimeMine : chatStyles.metaTimeTheirs,
              ]}
            >
              {time}
            </Text>
            {mine && readState && (
              <Ionicons
                name={readState === 'read' ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={
                  readState === 'read' ? COLORS.brand200 : 'rgba(255,255,255,0.65)'
                }
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// TypingDots — animasi tiga titik (Wave)
// ═══════════════════════════════════════════════════════════════════
const Dot = ({ delay }: { delay: number }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 420,
          delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Animated.View
      style={[chatStyles.typingDot, { transform: [{ translateY }], opacity }]}
    />
  );
};

interface TypingDotsProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}
export const TypingDots = ({ label = 'mengetik', style }: TypingDotsProps) => (
  <View style={[chatStyles.typingRow, style]}>
    <View style={chatStyles.typingBubble}>
      <View style={chatStyles.typingDots}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
    {!!label && <Text style={chatStyles.typingLabel}>{label}</Text>}
  </View>
);

// ═══════════════════════════════════════════════════════════════════
// ChatHeader — kompak khas messenger
// ═══════════════════════════════════════════════════════════════════
interface ChatHeaderProps {
  name: string;
  subtitle: string;
  online?: boolean;
  typing?: boolean;
  onBack?: () => void;
  variant?: 'patient' | 'doctor';
  rightSlot?: ReactNode;
}

export const ChatHeader = ({
  name,
  subtitle,
  online,
  typing,
  onBack,
  variant = 'doctor',
  rightSlot,
}: ChatHeaderProps) => {
  const status = typing
    ? 'mengetik…'
    : online
    ? 'online'
    : subtitle;

  return (
    <View style={chatStyles.header}>
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          accessibilityLabel="Kembali"
          accessibilityRole="button"
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          style={chatStyles.headerBack}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}
      <Avatar name={name} size={40} variant={variant} online={!!online} />
      <View style={chatStyles.headerText}>
        <Text style={chatStyles.headerName} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[
            chatStyles.headerStatus,
            typing && { color: COLORS.primary },
            !typing && online && { color: COLORS.success },
          ]}
          numberOfLines={1}
        >
          {status}
        </Text>
      </View>
      {rightSlot && <View>{rightSlot}</View>}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ChatComposer — input + send button
// ═══════════════════════════════════════════════════════════════════
interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTyping?: (typing: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatComposer = ({
  value,
  onChange,
  onSend,
  onTyping,
  disabled,
  placeholder = 'Tulis pesan…',
}: ChatComposerProps) => {
  const canSend = value.trim().length > 0 && !disabled;
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (t: string) => {
    onChange(t);
    if (!onTyping) return;
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1200);
  };

  return (
    <View style={chatStyles.composer}>
      <View style={chatStyles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textDisabled}
          style={chatStyles.input}
          multiline
          maxLength={4000}
          underlineColorAndroid="transparent"
        />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Kirim pesan"
        activeOpacity={0.85}
        disabled={!canSend}
        onPress={onSend}
        style={[chatStyles.sendBtn, !canSend && chatStyles.sendBtnDisabled]}
      >
        <Ionicons name="send" size={18} color={COLORS.textOnPrimary} />
      </TouchableOpacity>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════
const chatStyles = StyleSheet.create({
  // Avatar
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { ...TYPO.h4, fontWeight: '700' },
  avatarDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  dot: {
    backgroundColor: COLORS.success,
  },

  // Unread badge
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    ...TYPO.caption,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    fontSize: 11,
  },

  // Date divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  dividerPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dividerText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
  },

  // Bubble
  row: { flexDirection: 'row', marginVertical: 1 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: 2,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  bubbleText: { ...TYPO.body, lineHeight: 21 },
  bubbleTextMine: { color: COLORS.textOnPrimary },
  bubbleTextTheirs: { color: COLORS.textPrimary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  metaTime: { ...TYPO.caption, fontSize: 10.5 },
  metaTimeMine: { color: 'rgba(255,255,255,0.78)' },
  metaTimeTheirs: { color: COLORS.textMuted },

  // Typing dots
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xs,
  },
  typingBubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderBottomLeftRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
  },
  typingLabel: { ...TYPO.caption, color: COLORS.textMuted },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  headerText: { flex: 1 },
  headerName: { ...TYPO.h3, color: COLORS.textPrimary },
  headerStatus: { ...TYPO.caption, color: COLORS.textMuted, marginTop: 2 },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  input: {
    minHeight: 32,
    maxHeight: 120,
    ...TYPO.body,
    color: COLORS.textPrimary,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.brand,
  },
  sendBtnDisabled: { opacity: 0.45 },
});

export default {
  Avatar,
  OnlineDot,
  UnreadBadge,
  DateDivider,
  MessageBubble,
  TypingDots,
  ChatHeader,
  ChatComposer,
};
