/**
 * StatusBadge — pill kecil untuk indikator status.
 * Warna semantik: pending, confirmed, completed, cancelled, info, custom.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/theme';

export type StatusKind =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral';

interface StatusBadgeProps {
  kind: StatusKind;
  label?: string;
  showDot?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const KIND_MAP: Record<
  StatusKind,
  { bg: string; fg: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending:   { bg: COLORS.warningBg, fg: COLORS.warningText, label: 'Menunggu',     icon: 'time' },
  confirmed: { bg: COLORS.infoBg,    fg: COLORS.infoText,    label: 'Dikonfirmasi', icon: 'checkmark-circle' },
  completed: { bg: COLORS.successBg, fg: COLORS.successText, label: 'Selesai',      icon: 'flag' },
  cancelled: { bg: COLORS.dangerBg,  fg: COLORS.dangerText,  label: 'Dibatalkan',   icon: 'close-circle' },
  success:   { bg: COLORS.successBg, fg: COLORS.successText, label: 'Sukses',       icon: 'checkmark-circle' },
  info:      { bg: COLORS.infoBg,    fg: COLORS.infoText,    label: 'Info',         icon: 'information-circle' },
  warning:   { bg: COLORS.warningBg, fg: COLORS.warningText, label: 'Perhatian',    icon: 'alert-circle' },
  danger:    { bg: COLORS.dangerBg,  fg: COLORS.dangerText,  label: 'Bahaya',       icon: 'alert-circle' },
  neutral:   { bg: COLORS.borderLight, fg: COLORS.textSecondary, label: 'Status',   icon: 'ellipse' },
};

export const StatusBadge = ({
  kind,
  label,
  showDot = false,
  showIcon = true,
  size = 'sm',
  style,
}: StatusBadgeProps) => {
  const tone = KIND_MAP[kind];
  const text = label ?? tone.label;
  const isMd = size === 'md';

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: tone.bg,
          paddingHorizontal: isMd ? SPACING.md : SPACING.sm + 2,
          paddingVertical: isMd ? 6 : 4,
        },
        style,
      ]}
    >
      {showDot && (
        <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      )}
      {showIcon && !showDot && (
        <Ionicons
          name={tone.icon}
          size={isMd ? 14 : 12}
          color={tone.fg}
          style={styles.icon}
        />
      )}
      <Text style={[isMd ? TYPO.labelSm : TYPO.caption, { color: tone.fg, fontWeight: '700' }]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs + 2,
  },
  icon: { marginRight: SPACING.xs + 1 },
});
