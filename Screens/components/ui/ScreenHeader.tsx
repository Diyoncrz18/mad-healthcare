/**
 * ScreenHeader — Title block konsisten untuk semua page.
 * Variants:
 *  - default: title + subtitle (tanpa back button) untuk root tab.
 *  - back: ada tombol kembali (untuk push screen).
 *  - hero: padding top lebih besar untuk landing.
 */
import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  variant?: 'default' | 'back' | 'hero';
  onBack?: () => void;
  rightSlot?: ReactNode;
  style?: ViewStyle;
}

export const ScreenHeader = ({
  title,
  subtitle,
  variant = 'default',
  onBack,
  rightSlot,
  style,
}: ScreenHeaderProps) => {
  const showBack = variant === 'back';

  return (
    <View
      style={[
        styles.base,
        variant === 'hero' && styles.hero,
        style,
      ]}
    >
      {showBack && onBack && (
        <TouchableOpacity
          accessibilityLabel="Kembali"
          accessibilityRole="button"
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      )}

      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {rightSlot && <View style={styles.right}>{rightSlot}</View>}
        </View>
        {!!subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  hero: { paddingTop: SPACING.xxl },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  textWrap: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  title: {
    ...TYPO.h1,
    color: COLORS.textPrimary,
    flex: 1,
  },
  subtitle: {
    ...TYPO.body,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  right: { marginTop: 4 },
});
