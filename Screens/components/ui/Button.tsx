/**
 * Button — Primary / Secondary / Outline / Ghost / Danger.
 * Touch target ≥ 48px, loading state, icon support.
 */
import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO, SHADOWS } from '../../constants/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
}

const HEIGHT_MAP: Record<ButtonSize, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

const PADDING_MAP: Record<ButtonSize, number> = {
  sm: SPACING.md,
  md: SPACING.lg,
  lg: SPACING.xl,
};

const FONT_MAP: Record<ButtonSize, TextStyle> = {
  sm: { ...TYPO.labelSm },
  md: { ...TYPO.label },
  lg: { ...TYPO.label, fontSize: 16 },
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'right',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return {
          bg: COLORS.primaryLight,
          fg: COLORS.primary,
          border: COLORS.primaryLight,
          shadow: SHADOWS.none,
        };
      case 'outline':
        return {
          bg: COLORS.surface,
          fg: COLORS.textPrimary,
          border: COLORS.border,
          shadow: SHADOWS.none,
        };
      case 'ghost':
        return {
          bg: 'transparent',
          fg: COLORS.primary,
          border: 'transparent',
          shadow: SHADOWS.none,
        };
      case 'danger':
        return {
          bg: COLORS.danger,
          fg: COLORS.textOnPrimary,
          border: COLORS.danger,
          shadow: SHADOWS.sm,
        };
      case 'success':
        return {
          bg: COLORS.accent,
          fg: COLORS.textOnPrimary,
          border: COLORS.accent,
          shadow: SHADOWS.sm,
        };
      case 'primary':
      default:
        return {
          bg: COLORS.primary,
          fg: COLORS.textOnPrimary,
          border: COLORS.primary,
          shadow: SHADOWS.brand,
        };
    }
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          height: HEIGHT_MAP[size],
          paddingHorizontal: PADDING_MAP[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          width: fullWidth ? '100%' : undefined,
          opacity: isDisabled ? 0.55 : 1,
        },
        palette.shadow as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {!!icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={palette.fg}
              style={styles.iconLeft}
            />
          )}
          <Text style={[FONT_MAP[size], { color: palette.fg }, textStyle]}>
            {label}
          </Text>
          {!!icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={palette.fg}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: SPACING.sm },
  iconRight: { marginLeft: SPACING.sm },
});
