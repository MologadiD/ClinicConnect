export type RootStackParamList = {
  Login: undefined;
  StaffLogin: undefined;
  ForgotPassword: undefined;
  RegisterStep1: undefined;
  RegisterStep2: { [key: string]: any };
  VerifyEmail: { email: string };

  PatientHome: { [key: string]: any } | undefined;
  PatientProfile: { patientId?: string } | undefined;
  MedicalRecord: { patientId?: string } | undefined;
  NearbyClinics: undefined;
  SelectClinic: undefined;
  BookAppointment: { clinicId?: string } | undefined;
  SelectService: { clinicId: string; clinicName?: string };
  SelectTimeSlot: {
    clinicId: string;
    clinicName?: string;
    serviceId: string;
    serviceName?: string;
  };
  ConfirmBooking: {
    clinicId: string;
    clinicName?: string;
    serviceId: string;
    serviceName?: string;
    timeSlotId: string;
    date: string;
    startTime: string;
    endTime?: string;
  };
  BookingSuccess: {
    clinicName?: string;
    serviceName?: string;
    date?: string;
    startTime?: string;
  };
  AppointmentDetail: { appointmentId: string };
  AppointmentHistory: undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
  Emergency: undefined;
  EmergencySuccess: undefined;
  HealthTips: undefined;
  Alerts: undefined;
  ClinicDetails: { clinicId: string };
  ServiceDetails: { serviceId: string };

  AdminDashboard: undefined;
  StaffList: undefined;
  StaffDetails: { staffId: string };
  AddStaff: undefined;
  ClinicManagement: undefined;
  ClinicDetailsScreen: { clinicId: string };
  ServiceManagement: undefined;
  TimeSlotManagement: undefined;
  StaffProfile: undefined;

  DoctorHome: undefined;
  DoctorProfile: undefined;
  NurseHome: undefined;
  NurseProfile: undefined;
  PatientDetailView: { patientId: string };
  PatientSearch: undefined;
  FirstResponderHome: undefined;
  FirstResponderProfile: undefined;
  DoctorMedicalRecord: { patientId?: string } | undefined;
  WritePrescription: { appointmentId: string; patientId: string; patientName?: string };
  Referral: { patientId?: string; referralId?: string; mode?: 'list' | 'create' } | undefined;
  Prescription: { prescriptionId: string };
  PrescriptionList: { patientId?: string; appointmentId?: string; patientName?: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}