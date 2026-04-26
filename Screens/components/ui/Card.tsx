/**
 * Card — Surface pembungkus content section.
 * Variants: default (white surface), muted (background), accent (left bar).
 */
import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../constants/theme';

type CardVariant = 'default' | 'muted' | 'outline' | 'accent' | 'flat';
type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps {
  variant?: CardVariant;
  padding?: Padding;
  accentColor?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const PAD_MAP: Record<Padding, number> = {
  none: 0,
  sm: SPACING.md,
  md: SPACING.lg,
  lg: SPACING.xl,
  xl: SPACING.xxl,
};

export const Card = ({
  variant = 'default',
  padding = 'lg',
  accentColor = COLORS.primary,
  children,
  style,
}: CardProps) => {
  const variantStyle: ViewStyle = (() => {
    switch (variant) {
      case 'muted':
        return {
          backgroundColor: COLORS.surfaceMuted,
          borderWidth: 1,
          borderColor: COLORS.borderLight,
        };
      case 'outline':
        return {
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.border,
        };
      case 'accent':
        return {
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderLeftWidth: 4,
          borderColor: COLORS.borderLight,
          borderLeftColor: accentColor,
          ...SHADOWS.sm,
        };
      case 'flat':
        return {
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.borderLight,
        };
      case 'default':
      default:
        return {
          backgroundColor: COLORS.surface,
          borderWidth: 1,
          borderColor: COLORS.borderLight,
          ...SHADOWS.sm,
        };
    }
  })();

  return (
    <View style={[styles.base, variantStyle, { padding: PAD_MAP[padding] }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: { borderRadius: RADIUS.xl },
});
