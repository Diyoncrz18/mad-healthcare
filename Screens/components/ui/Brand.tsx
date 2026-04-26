/**
 * Brand — Identitas Visual CareConnect
 * Logo mark, wordmark, dan combo lockup dengan ukuran konsisten.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/theme';

type BrandSize = 'sm' | 'md' | 'lg';

interface BrandMarkProps {
  size?: BrandSize;
  variant?: 'light' | 'dark' | 'solid';
  style?: ViewStyle;
}

const SIZE_MAP: Record<BrandSize, { box: number; icon: number; radius: number }> = {
  sm: { box: 44, icon: 22, radius: RADIUS.md },
  md: { box: 64, icon: 32, radius: RADIUS.lg },
  lg: { box: 84, icon: 42, radius: RADIUS.xl },
};

/**
 * BrandMark — logo cross icon di dalam soft tile.
 * Symbolic, professional, no rotation gimmick.
 */
export const BrandMark = ({ size = 'md', variant = 'light', style }: BrandMarkProps) => {
  const dim = SIZE_MAP[size];

  const palette =
    variant === 'solid'
      ? { bg: COLORS.primary, fg: COLORS.surface, ring: COLORS.primaryDark }
      : variant === 'dark'
      ? { bg: COLORS.brand900, fg: COLORS.brand200, ring: COLORS.brand800 }
      : { bg: COLORS.primaryLight, fg: COLORS.primary, ring: COLORS.brand200 };

  return (
    <View
      style={[
        styles.markBase,
        {
          width: dim.box,
          height: dim.box,
          borderRadius: dim.radius,
          backgroundColor: palette.bg,
          borderColor: palette.ring,
        },
        style,
      ]}
    >
      <Ionicons name="medical" size={dim.icon} color={palette.fg} />
    </View>
  );
};

interface BrandLockupProps {
  size?: BrandSize;
  align?: 'center' | 'start';
  tagline?: string;
  caption?: string;
  variant?: BrandMarkProps['variant'];
}

/**
 * BrandLockup — gabungan logo + nama + tagline (untuk auth/header hero).
 */
export const BrandLockup = ({
  size = 'md',
  align = 'center',
  tagline = 'Portal Kesehatan Terpadu',
  caption,
  variant = 'light',
}: BrandLockupProps) => (
  <View
    style={[
      styles.lockup,
      align === 'center' ? styles.alignCenter : styles.alignStart,
    ]}
  >
    <BrandMark size={size} variant={variant} />
    <Text style={[styles.appName, align === 'center' && styles.textCenter]}>
      CareConnect
    </Text>
    {!!tagline && (
      <Text style={[styles.tagline, align === 'center' && styles.textCenter]}>
        {tagline}
      </Text>
    )}
    {!!caption && (
      <Text style={[styles.caption, align === 'center' && styles.textCenter]}>
        {caption}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  markBase: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  lockup: { gap: SPACING.sm },
  alignCenter: { alignItems: 'center' },
  alignStart: { alignItems: 'flex-start' },
  textCenter: { textAlign: 'center' },
  appName: {
    ...TYPO.h1,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  tagline: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  caption: {
    ...TYPO.bodySm,
    color: COLORS.textMuted,
  },
});
