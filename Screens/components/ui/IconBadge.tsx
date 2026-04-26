/**
 * IconBadge — round/rounded tile berisi ikon di depan list item, stat card, dll.
 * Konsisten ukuran: sm 36 / md 44 / lg 56.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../../constants/theme';

type Tone =
  | 'brand'
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'doctor'
  | 'admin';

type Size = 'sm' | 'md' | 'lg';

interface IconBadgeProps {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: Size;
  shape?: 'square' | 'circle';
  style?: ViewStyle;
  iconColor?: string;
  bgColor?: string;
}

const TONE_MAP: Record<Tone, { bg: string; fg: string }> = {
  brand:   { bg: COLORS.primaryLight,        fg: COLORS.primary },
  success: { bg: COLORS.successBg,           fg: COLORS.success },
  info:    { bg: COLORS.infoBg,              fg: COLORS.info },
  warning: { bg: COLORS.warningBg,           fg: COLORS.warning },
  danger:  { bg: COLORS.dangerBg,            fg: COLORS.danger },
  neutral: { bg: COLORS.borderLight,         fg: COLORS.textSecondary },
  doctor:  { bg: COLORS.doctorPrimaryLight,  fg: COLORS.doctorPrimary },
  admin:   { bg: COLORS.adminPrimaryLight,   fg: COLORS.adminPrimary },
};

const SIZE_MAP: Record<Size, { box: number; icon: number; radius: number }> = {
  sm: { box: 36, icon: 16, radius: RADIUS.md },
  md: { box: 44, icon: 20, radius: RADIUS.lg },
  lg: { box: 56, icon: 26, radius: RADIUS.xl },
};

export const IconBadge = ({
  icon,
  tone = 'brand',
  size = 'md',
  shape = 'square',
  style,
  iconColor,
  bgColor,
}: IconBadgeProps) => {
  const palette = TONE_MAP[tone];
  const dim = SIZE_MAP[size];
  const radius = shape === 'circle' ? dim.box / 2 : dim.radius;

  return (
    <View
      style={[
        styles.base,
        {
          width: dim.box,
          height: dim.box,
          borderRadius: radius,
          backgroundColor: bgColor ?? palette.bg,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={dim.icon} color={iconColor ?? palette.fg} />
    </View>
  );
};

const styles = StyleSheet.create({
  base: { justifyContent: 'center', alignItems: 'center' },
});
