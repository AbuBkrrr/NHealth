// Ported directly from the original HTML prototype's CSS variables,
// so the app keeps the same visual identity per role.
export const colors = {
  primary: '#1A73E8',
  primaryDark: '#0D47A1',
  primaryLight: '#E8F0FE',
  secondary: '#34A853',
  success: '#34A853',
  error: '#EA4335',
  warning: '#FBBC04',
  emergencyRed: '#D32F2F',
  emergencyAmber: '#FFA000',
  textPrimary: '#202124',
  textSecondary: '#5F6368',
  textLight: '#9AA0A6',
  surface: '#F5F7FA',
  white: '#FFFFFF',

  doctor: '#1A73E8',
  doctorLight: '#E8F0FE',
  pharmacy: '#00C853',
  pharmacyLight: '#E8F5E9',
  lab: '#1565C0',
  labLight: '#E3F2FD',
  ambulance: '#FF6F00',
  ambulanceLight: '#FFF3E0',
  nurse: '#C2185B',
  nurseLight: '#FCE4EC',
};

export const roleColor: Record<string, string> = {
  PATIENT: colors.primary,
  DOCTOR: colors.doctor,
  PHARMACY: colors.pharmacy,
  LAB: colors.lab,
  AMBULANCE: colors.ambulance,
  NURSE: colors.nurse,
};

export const radius = { md: 16, sm: 8 };
