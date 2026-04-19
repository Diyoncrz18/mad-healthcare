/**
 * Design Token / Theme Constants
 * Satu sumber kebenaran (single source of truth) untuk seluruh warna dan styling
 * yang dipakai di aplikasi CareConnect.
 */

// ─── Warna Primer ────────────────────────────────────────────────
export const COLORS = {
  // Brand Colors
  userPrimary: '#2563EB',
  userPrimaryLight: '#EFF6FF',
  adminPrimary: '#0D9488',
  adminPrimaryLight: '#F0FDFA',
  doctorPrimary: '#8B5CF6',
  doctorPrimaryLight: '#F5F3FF',
  accent: '#6366F1',
  accentLight: '#EEF2FF',

  // Neutral Palette (Slate)
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text
  textPrimary: '#1E293B',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textDisabled: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#16A34A',
  successBg: '#DCFCE7',
  successText: '#166534',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  dangerText: '#991B1B',
  dangerLight: '#FEF2F2',
  warning: '#F59E0B',
  warningBg: '#FEF9C3',
  warningText: '#854D0E',
  info: '#0EA5E9',
  infoBg: '#F0F9FF',
  infoText: '#0369A1',
  infoBorder: '#BAE6FD',
  completeBg: '#DBEAFE',
  completeText: '#1E40AF',

  // Misc
  inputBg: '#F8FAFC',
  overlay: 'rgba(15, 23, 42, 0.4)',
  shadowColor: '#0F172A',
} as const;

// ─── Tipografi ───────────────────────────────────────────────────
export const FONTS = {
  heading: { fontWeight: '800' as const, letterSpacing: -0.5 },
  subheading: { fontWeight: '700' as const },
  body: { fontWeight: '500' as const },
  label: { fontWeight: '600' as const },
  caption: { fontWeight: '500' as const },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ───────────────────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

// ─── Shadow Presets ──────────────────────────────────────────────
export const SHADOWS = {
  sm: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
