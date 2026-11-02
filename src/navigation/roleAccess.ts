import { AppRole } from '../context/AuthContext';
import { RootStackParamList } from './types';

/** Screens each role is allowed to open. Everything else is blocked. */
export const ROLE_SCREENS: Record<NonNullable<AppRole>, (keyof RootStackParamList)[]> = {
  patient: [
    'PatientHome',
    'PatientProfile',
    'MedicalRecord',
    'NearbyClinics',
    'SelectClinic',
    'BookAppointment',
    'SelectService',
    'SelectTimeSlot',
    'ConfirmBooking',
    'BookingSuccess',
    'AppointmentDetail',
    'AppointmentHistory',
    'Notifications',
    'NotificationPreferences',
    'Emergency',
    'HealthTips',
    'Alerts',
    'ClinicDetails',
  ],
  Doctor: [
    'DoctorHome',
    'PatientSearch',
    'PatientDetailView',
    'DoctorMedicalRecord',
    'WritePrescription',
    'MedicalRecord',
    'Notifications',
    'NotificationPreferences',
    'StaffProfile',
  ],
  Nurse: [
    'NurseHome',
    'NurseProfile',
    'PatientSearch',
    'PatientDetailView',
    'MedicalRecord',
    'Notifications',
    'NotificationPreferences',
  ],
  Admin: [
    'AdminDashboard',
    'StaffList',
    'StaffDetails',
    'AddStaff',
    'ClinicManagement',
    'ClinicDetailsScreen',
    'ServiceManagement',
    'TimeSlotManagement',
    'StaffProfile',
    'Notifications',
    'NotificationPreferences',
  ],
  FirstResponder: [
    'FirstResponderHome',
    'FirstResponderProfile',
    'Notifications',
    'NotificationPreferences',
  ],
};

export function canAccessScreen(
  role: AppRole,
  screen: keyof RootStackParamList
): boolean {
  if (!role) return false;
  return ROLE_SCREENS[role]?.includes(screen) ?? false;
}

export function getHomeForRole(role: AppRole): keyof RootStackParamList {
  switch (role) {
    case 'patient':
      return 'PatientHome';
    case 'Doctor':
      return 'DoctorHome';
    case 'Nurse':
      return 'NurseHome';
    case 'Admin':
      return 'AdminDashboard';
    case 'FirstResponder':
      return 'FirstResponderHome';
    default:
      return 'Login';
  }
}
