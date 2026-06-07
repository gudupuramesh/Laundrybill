export const colors = {
  primary: '#1B61E5',
  primaryDark: '#1A57CC',
  primaryTint: '#E8F0FE',
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FC',

  text: '#1A1D2E',
  textSecondary: '#5B6473',
  textMuted: '#8A93A3',

  border: '#E6E9EF',
  divider: '#E6E9EF',

  success: '#16A34A',
  successBg: '#DCFCE7',
  error: '#E1382D',
  errorBg: '#FEE2E2',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  inProgress: '#06B6D4',
  inProgressBg: '#CFFAFE',

  darkBlue: '#0F1E36',
  mint: '#6cd1b3',

  navActive: '#1B61E5',
  navActiveBg: '#E8F0FE',
  navInactive: '#8A93A3',
} as const;

export const fonts = {
  light: 'Quicksand_300Light',
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semibold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
  extrabold: 'Quicksand_700Bold',
} as const;

export const radii = {
  card: 18,
  input: 14,
  button: 12,
  chip: 20,
  badge: 8,
  avatar: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBorder: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)' as string,
  },
  fab: {
    shadowColor: '#1B61E5',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  elevated: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const typography = {
  pageTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    color: colors.text,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bodySmall: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.surface,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.text,
  },
  amountLarge: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    color: colors.text,
  },
  badge: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
} as const;
