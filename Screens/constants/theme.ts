/**
 * CareConnect — Design System (Healthcare Edition)
 *
 * Single source of truth untuk seluruh styling aplikasi.
 * Filosofi:
 *   - ONE brand identity: Medical Teal (#0891B2) — calm & trustworthy.
 *   - Health Green (#059669) sebagai accent CTA / vitality.
 *   - Role differentiation lewat ICON + LABEL + sedikit shade bukan warna berbeda.
 *   - Slate neutral untuk text & surface.
 *   - WCAG AA contrast minimum (4.5:1 body text).
 *   - Touch target 44×44px minimum.
 *
 * Inspired by: Medical Clinic UI patterns (UI Pro Max),
 * Apple Human Interface Guidelines for Health, dan Material Design 3.
 */

// ═══════════════════════════════════════════════════════════════════
// 1. COLORS
// ═══════════════════════════════════════════════════════════════════
export const COLORS = {
  // ── Brand: Medical Teal Scale ──────────────────────────────────
  brand50:  '#ECFEFF',
  brand100: '#CFFAFE',
  brand200: '#A5F3FC',
  brand300: '#67E8F9',
  brand400: '#22D3EE',
  brand500: '#06B6D4',
  brand600: '#0891B2', // ★ PRIMARY
  brand700: '#0E7490',
  brand800: '#155E75',
  brand900: '#164E63',

  // ── Aliases (semantic) ─────────────────────────────────────────
  primary:        '#0891B2',
  primaryDark:    '#0E7490',
  primaryLight:   '#ECFEFF',
  primarySurface: '#F0FDFA',

  // Accent / CTA — Health Green (vitality)
  accent:         '#059669',
  accentDark:     '#047857',
  accentLight:    '#ECFDF5',

  // ── Role Accents (subtle: warna berbeda hanya pada chip/tab) ─
  // Patient → primary teal. Doctor → deeper teal. Admin → slate.
  patientPrimary:      '#0891B2',
  patientPrimaryLight: '#ECFEFF',
  doctorPrimary:       '#0E7490',
  doctorPrimaryLight:  '#CFFAFE',
  adminPrimary:        '#475569',
  adminPrimaryLight:   '#F1F5F9',

  // ── Neutral Palette (Slate) ───────────────────────────────────
  background:   '#F8FAFC',
  backgroundAlt:'#F1F5F9',
  surface:      '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border:       '#E2E8F0',
  borderLight:  '#F1F5F9',
  borderStrong: '#CBD5E1',
  divider:      '#E2E8F0',

  // ── Text ───────────────────────────────────────────────────────
  textPrimary:    '#0F172A', // slate-900 — heading
  textSecondary:  '#334155', // slate-700 — body
  textMuted:      '#64748B', // slate-500 — caption
  textDisabled:   '#94A3B8', // slate-400 — placeholder
  textOnPrimary:  '#FFFFFF',
  textOnAccent:   '#FFFFFF',
  textBrandDeep:  '#164E63', // tinted dark for brand surfaces

  // ── Status (semantic) ──────────────────────────────────────────
  success:     '#059669',
  successBg:   '#D1FAE5',
  successText: '#065F46',

  danger:      '#DC2626',
  dangerBg:    '#FEE2E2',
  dangerText:  '#991B1B',
  dangerLight: '#FEF2F2',

  warning:     '#D97706',
  warningBg:   '#FEF3C7',
  warningText: '#92400E',

  info:        '#0284C7',
  infoBg:      '#E0F2FE',
  infoText:    '#075985',
  infoBorder:  '#BAE6FD',

  completeBg:   '#DBEAFE',
  completeText: '#1E40AF',

  // ── Form / Misc ───────────────────────────────────────────────
  inputBg:    '#F8FAFC',
  inputBorder:'#E2E8F0',
  overlay:    'rgba(15, 23, 42, 0.45)',
  shadowColor:'#0F172A',

  // ── Backwards-compat aliases (jangan dihapus, untuk import lama) ──
  userPrimary:      '#0891B2',
  userPrimaryLight: '#ECFEFF',
  accentLight2:     '#ECFDF5',
} as const;

// ═══════════════════════════════════════════════════════════════════
// 2. TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════
/**
 * Type scale modular (1.125 / 1.25). Pakai `TYPO` untuk styling
 * lengkap, atau kombinasikan FONTS + ukuran manual untuk legacy code.
 */
export const TYPO = {
  // Display & Heading
  display:   { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 38 },
  h1:        { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4, lineHeight: 32 },
  h2:        { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
  h3:        { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 24 },
  h4:        { fontSize: 16, fontWeight: '700' as const, letterSpacing: 0,    lineHeight: 22 },

  // Body
  bodyLg:    { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  body:      { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  bodySm:    { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },

  // Label & Caption
  label:     { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  labelSm:   { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  caption:   { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  overline:  { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const, lineHeight: 14 },
} as const;

// Backwards-compat (FONTS partial style sets)
export const FONTS = {
  heading:    { fontWeight: '800' as const, letterSpacing: -0.4 },
  subheading: { fontWeight: '700' as const },
  body:       { fontWeight: '500' as const },
  label:      { fontWeight: '600' as const },
  caption:    { fontWeight: '500' as const },
} as const;

// ═══════════════════════════════════════════════════════════════════
// 3. SPACING (4px baseline grid)
// ═══════════════════════════════════════════════════════════════════
export const SPACING = {
  xs:    4,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  xxl:   24,
  xxxl:  32,
  huge:  40,
  giant: 48,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 4. RADIUS
// ═══════════════════════════════════════════════════════════════════
export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  pill: 999,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 5. SHADOWS (3-tier elevation)
// ═══════════════════════════════════════════════════════════════════
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  brand: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════
// 6. LAYOUT TOKENS
// ═══════════════════════════════════════════════════════════════════
export const LAYOUT = {
  screenPaddingX:   20,
  screenPaddingTop: 16,
  contentMaxWidth:  720,
  bottomTabHeight:  84,
  bottomSafeGap:    100, // ScrollView contentContainerStyle paddingBottom default
  hairline:         1,
  touchMin:         44,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 7. ROLE THEME (derived helper)
// ═══════════════════════════════════════════════════════════════════
export type AppRole = 'user' | 'doctor' | 'admin';

export const getRoleTheme = (role: AppRole) => {
  switch (role) {
    case 'doctor':
      return {
        primary:      COLORS.doctorPrimary,
        primaryLight: COLORS.doctorPrimaryLight,
        label:        'Dokter',
        icon:         'medkit' as const,
      };
    case 'admin':
      return {
        primary:      COLORS.adminPrimary,
        primaryLight: COLORS.adminPrimaryLight,
        label:        'Administrator',
        icon:         'shield-checkmark' as const,
      };
    default:
      return {
        primary:      COLORS.patientPrimary,
        primaryLight: COLORS.patientPrimaryLight,
        label:        'Pasien',
        icon:         'person' as const,
      };
  }
};

