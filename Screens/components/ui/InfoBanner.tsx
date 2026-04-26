/**
 * InfoBanner — Inline alert/note untuk informasi, peringatan, atau callout.
 * Tone: info, warning, danger, success, brand.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/theme';

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'brand';

interface InfoBannerProps {
  tone?: Tone;
  title?: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

const TONE_MAP: Record<Tone, { bg: string; border: string; fg: string; defaultIcon: keyof typeof Ionicons.glyphMap }> = {
  info:    { bg: COLORS.infoBg,        border: COLORS.infoBorder, fg: COLORS.infoText,    defaultIcon: 'information-circle' },
  warning: { bg: COLORS.warningBg,     border: '#FCD34D',         fg: COLORS.warningText, defaultIcon: 'warning' },
  danger:  { bg: COLORS.dangerLight,   border: '#FCA5A5',         fg: COLORS.dangerText,  defaultIcon: 'alert-circle' },
  success: { bg: COLORS.successBg,     border: '#86EFAC',         fg: COLORS.successText, defaultIcon: 'checkmark-circle' },
  brand:   { bg: COLORS.primaryLight,  border: COLORS.brand200,   fg: COLORS.brand900,    defaultIcon: 'medical' },
};

export const InfoBanner = ({
  tone = 'info',
  title,
  message,
  icon,
  style,
}: InfoBannerProps) => {
  const palette = TONE_MAP[tone];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      <Ionicons
        name={icon ?? palette.defaultIcon}
        size={20}
        color={palette.fg}
        style={styles.icon}
      />
      <View style={styles.body}>
        {!!title && <Text style={[styles.title, { color: palette.fg }]}>{title}</Text>}
        <Text style={[styles.message, { color: palette.fg }]}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  icon: { marginRight: SPACING.md, marginTop: 2 },
  body: { flex: 1, gap: 2 },
  title: { ...TYPO.label, fontWeight: '700' },
  message: { ...TYPO.bodySm, lineHeight: 20 },
});
