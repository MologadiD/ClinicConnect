import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import type { StaffRole } from '../types';

// Role permissions

export type AppRole = 'patient' | StaffRole;
export type Permission = 'records:write' | 'admin:manage' | 'emergency:respond';

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  patient: [],
  Doctor: ['records:write'],
  Nurse: ['records:write'],
  Admin: ['records:write', 'admin:manage'],
  FirstResponder: ['emergency:respond'],
};

export function hasPermission(role: AppRole | null | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role]?.includes(permission);
}

// Device permissions (each resolves to true when granted)

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}