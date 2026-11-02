import type { StaffRole } from '../types';

export const APP_NAME = 'ClinicConnect';

// Locale and time zone used for every date/time shown in the app.
export const LOCALE = 'en-ZA';
export const TIME_ZONE = 'Africa/Johannesburg';

export const EMERGENCY_NUMBERS = {
  general: '112', // from a cellphone
  ambulance: '10177',
  police: '10111',
} as const;

export const STAFF_ROLES: readonly StaffRole[] = ['Doctor', 'Nurse', 'Admin', 'FirstResponder'];

// Every doctor added from the admin screens is a General Practitioner.
export const GP_SPECIALIZATION = 'General Practitioner (GP)';

export const DEPARTMENTS = [
  'General Medicine',
  'Nursing',
  'Pediatrics & Child Health',
  "Women's Health / OB-GYN",
  'Chronic Care / Internal Medicine',
  'Mental Health',
  'Pharmacy',
  'Laboratory / Diagnostics',
  'Radiology / Imaging',
] as const;

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export const ETHNICITY_OPTIONS = ['African', 'Coloured', 'Indian/Asian', 'White', 'Other'] as const;

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
] as const;