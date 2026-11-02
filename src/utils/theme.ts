// src/utils/theme.ts
//
// The colours that were hard-coded across the screens, in one place.

export const colors = {
  primary: '#6B7C5C', // sage green used for headers, buttons and spinners
  primaryDark: '#2E7D32',
  accent: '#B08968',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#1a1a1a',
  textSecondary: '#757575',
  textMuted: '#9E9E9E',
  border: '#E8E8E8',
  error: '#E53935',
  errorDark: '#C62828',
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
} as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;

export const ROLE_COLORS: Record<string, string> = {
  Doctor: colors.info,
  Nurse: colors.success,
  Admin: colors.warning,
  FirstResponder: colors.error,
};

export const EMERGENCY_STATUS_COLORS: Record<string, string> = {
  pending: colors.error,
  dispatched: colors.warning,
  resolved: colors.success,
  cancelled: colors.textMuted,
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#B71C1C',
  high: colors.error,
  medium: '#FB8C00',
  low: '#43A047',
};

export const getRoleColor = (role?: string | null): string =>
  (role && ROLE_COLORS[role]) || '#666666';

export const getEmergencyStatusColor = (status?: string | null): string =>
  (status && EMERGENCY_STATUS_COLORS[status]) || '#999999';

export const getPriorityColor = (priority?: string | null): string =>
  (priority && PRIORITY_COLORS[priority]) || colors.error;

/** "#E53935", 0.13 -> "#E5393521". Handy for tinted badge backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}