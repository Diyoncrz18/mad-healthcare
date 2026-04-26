/**
 * States — Loading / Empty / Error reusable.
 * Konsisten across semua list dan detail screen.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/theme';
import { Button } from './Button';

// ── Loading ───────────────────────────────────────────────────────
interface LoadingStateProps {
  label?: string;
  color?: string;
  fullscreen?: boolean;
  style?: ViewStyle;
}

export const LoadingState = ({
  label = 'Memuat data…',
  color = COLORS.primary,
  fullscreen = false,
  style,
}: LoadingStateProps) => (
  <View style={[fullscreen ? styles.fullscreen : styles.inline, style]}>
    <ActivityIndicator size="large" color={color} />
    {!!label && <Text style={styles.loadingText}>{label}</Text>}
  </View>
);

// ── Empty ─────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) => (
  <View style={[styles.empty, style]}>
    <View style={styles.emptyIconRing}>
      <Ionicons name={icon} size={36} color={COLORS.textDisabled} />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {!!description && <Text style={styles.emptyDesc}>{description}</Text>}
    {!!actionLabel && !!onAction && (
      <Button
        label={actionLabel}
        onPress={onAction}
        variant="secondary"
        size="sm"
        style={{ marginTop: SPACING.lg }}
      />
    )}
  </View>
);

// ── Error ─────────────────────────────────────────────────────────
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
  inline?: boolean;
}

export const ErrorState = ({
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
  style,
  inline = false,
}: ErrorStateProps) => (
  <View style={[inline ? styles.errorInline : styles.errorBlock, style]}>
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
    {!!onRetry && (
      <Button
        label={retryLabel}
        onPress={onRetry}
        variant="ghost"
        size="sm"
        icon="refresh"
        iconPosition="left"
        style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        textStyle={{ color: COLORS.danger }}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    backgroundColor: COLORS.background,
  },
  inline: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
  },
  loadingText: {
    ...TYPO.body,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.huge,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { ...TYPO.h3, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm },
  emptyDesc: { ...TYPO.body, color: COLORS.textMuted, textAlign: 'center' },
  errorBlock: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.dangerBg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  errorInline: {
    backgroundColor: 'transparent',
    paddingVertical: SPACING.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  errorText: {
    ...TYPO.bodySm,
    color: COLORS.dangerText,
    flex: 1,
    lineHeight: 20,
  },
});
