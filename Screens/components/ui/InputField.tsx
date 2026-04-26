/**
 * InputField — Text input konsisten dengan label + leading icon + trailing slot.
 * Memenuhi WCAG: visible label (bukan placeholder-only), focus state.
 */
import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/theme';

interface InputFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  errorText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightSlot?: ReactNode;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  isPassword?: boolean;
}

export const InputField = ({
  label,
  hint,
  errorText,
  icon,
  rightSlot,
  multiline = false,
  containerStyle,
  isPassword = false,
  ...inputProps
}: InputFieldProps) => {
  const [focused, setFocused] = useState(false);
  const [hideText, setHideText] = useState(isPassword);

  const borderColor = errorText
    ? COLORS.danger
    : focused
    ? COLORS.primary
    : COLORS.inputBorder;

  return (
    <View style={containerStyle}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.wrap,
          multiline && styles.wrapMultiline,
          { borderColor },
        ]}
      >
        {!!icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.primary : COLORS.textMuted}
            style={styles.icon}
          />
        )}
        <TextInput
          {...inputProps}
          multiline={multiline}
          secureTextEntry={isPassword ? hideText : inputProps.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          placeholderTextColor={COLORS.textDisabled}
          style={[styles.input, multiline && styles.inputMultiline, inputProps.style]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {isPassword && (
          <TouchableOpacity
            accessibilityLabel={hideText ? 'Tampilkan password' : 'Sembunyikan password'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setHideText((s) => !s)}
            style={styles.trailingTouch}
          >
            <Ionicons
              name={hideText ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
        {rightSlot}
      </View>
      {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
      {!errorText && !!hint && <Text style={styles.hintText}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    ...TYPO.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  wrapMultiline: {
    minHeight: 120,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  icon: { marginRight: SPACING.sm + 2 },
  input: {
    flex: 1,
    ...TYPO.body,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  inputMultiline: { paddingTop: 0, paddingBottom: 0 },
  trailingTouch: { padding: SPACING.xs, marginLeft: SPACING.xs },
  errorText: {
    ...TYPO.caption,
    color: COLORS.danger,
    marginTop: SPACING.xs + 2,
  },
  hintText: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs + 2,
  },
});
