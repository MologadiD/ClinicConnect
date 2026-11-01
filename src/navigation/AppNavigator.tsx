import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import StaffLoginScreen from '../screens/auth/StaffLoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import RegisterStep1Screen from '../screens/auth/RegisterStep1Screen';
import RegisterStep2Screen from '../screens/auth/RegisterStep2Screen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';

// Patient
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import NearbyClinicsScreen from '../screens/patient/NearbyClinicsScreen';
import MedicalRecordScreen from '../screens/medical/MedicalRecordScreen';
import PatientProfileScreen from '../screens/patient/PatientProfileScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import NotificationPreferencesScreen from '../screens/notifications/NotificationPreferencesScreen';
import EmergencyScreen from '../screens/emergency/EmergencyScreen';
import HealthTipsScreen from '../screens/patient/HealthTipsScreen';
import AlertsScreen from '../screens/patient/AlertsScreen';
import BookAppointmentScreen from '../screens/appointments/BookAppointmentScreen';
import SelectClinicScreen from '../screens/appointments/SelectClinicScreen';
import SelectServiceScreen from '../screens/appointments/SelectServiceScreen';
import SelectTimeSlotScreen from '../screens/appointments/SelectTimeSlotScreen';
import ConfirmBookingScreen from '../screens/appointments/ConfirmBookingScreen';
import SuccessScreen from '../screens/appointments/SuccessScreen';
import AppointmentDetailScreen from '../screens/appointments/AppointmentDetailScreen';
import AppointmentHistoryScreen from '../screens/appointments/AppointmentHistoryScreen';
import PatientClinicDetailScreen from '../screens/patient/ClinicDetailScreen';

// Admin
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import StaffListScreen from '../screens/admin/StaffListScreen';
import StaffDetailsScreen from '../screens/admin/StaffDetailsScreen';
import AddStaffScreen from '../screens/admin/AddStaffScreen';
import ClinicManagementScreen from '../screens/admin/ClinicManagementScreen';
import AdminClinicDetailsScreen from '../screens/admin/ClinicDetailsScreen';
import ServiceManagementScreen from '../screens/admin/ServicesManagementScreen';
import TimeSlotManagementScreen from '../screens/admin/TimeSlotManagementScreen';
import StaffProfileScreen from '../screens/admin/StaffProfileScreen';

// Staff
import DoctorHomeScreen from '../screens/staff/DoctorHomeScreen';
import DoctorProfileScreen from '../screens/staff/DoctorProfileScreen';
import NurseHomeScreen from '../screens/staff/NurseHomeScreen';
import NurseProfileScreen from '../screens/staff/NurseProfileScreen';
import PatientDetailViewScreen from '../screens/staff/PatientDetailViewScreen';
import PatientSearchScreen from '../screens/staff/PatientSearchScreen';
import FirstResponderHomeScreen from '../screens/emergency/FirstResponderHomeScreen';
import FirstResponderProfileScreen from '../screens/emergency/FirstResponderProfileScreen';
import DoctorMedicalRecordScreen from '../screens/medical/DoctorMedicalRecordScreen';

import { RootStackParamList } from './types';
import { useAuth, AppRole } from '../context/AuthContext';
import { getHomeForRole } from './roleAccess';

const Stack = createStackNavigator<RootStackParamList>();

const screenOpts = {
  headerShown: false,
  cardStyle: { backgroundColor: '#F5F5F5' },
};

/**
 * Returns Screen elements only. Must be called as a function (not <Component />)
 * so React Navigation sees Screen/Fragment as direct children.
 */
function getRoleScreens(role: AppRole): React.ReactNode {
  switch (role) {
    case 'patient':
      return (
        <>
          <Stack.Screen name="PatientHome" component={PatientHomeScreen} />
          <Stack.Screen name="PatientProfile" component={PatientProfileScreen} />
          <Stack.Screen name="MedicalRecord" component={MedicalRecordScreen} />
          <Stack.Screen name="NearbyClinics" component={NearbyClinicsScreen} />
          <Stack.Screen name="SelectClinic" component={SelectClinicScreen} />
          <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
          <Stack.Screen name="SelectService" component={SelectServiceScreen} />
          <Stack.Screen name="SelectTimeSlot" component={SelectTimeSlotScreen} />
          <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
          <Stack.Screen name="BookingSuccess" component={SuccessScreen} />
          <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
          <Stack.Screen name="AppointmentHistory" component={AppointmentHistoryScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
          <Stack.Screen name="Emergency" component={EmergencyScreen} />
          <Stack.Screen name="HealthTips" component={HealthTipsScreen} />
          <Stack.Screen name="Alerts" component={AlertsScreen} />
          <Stack.Screen name="ClinicDetails" component={PatientClinicDetailScreen} />
        </>
      );

    case 'Doctor':
      return (
        <>
          <Stack.Screen name="DoctorHome" component={DoctorHomeScreen} />
          <Stack.Screen name="DoctorProfile" component={DoctorProfileScreen} />
          <Stack.Screen name="PatientSearch" component={PatientSearchScreen} />
          <Stack.Screen name="PatientDetailView" component={PatientDetailViewScreen} />
          <Stack.Screen name="DoctorMedicalRecord" component={DoctorMedicalRecordScreen} />
          <Stack.Screen name="MedicalRecord" component={MedicalRecordScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
          <Stack.Screen name="StaffProfile" component={StaffProfileScreen} />
        </>
      );

    case 'Nurse':
      return (
        <>
          <Stack.Screen name="NurseHome" component={NurseHomeScreen} />
          <Stack.Screen name="NurseProfile" component={NurseProfileScreen} />
          <Stack.Screen name="PatientSearch" component={PatientSearchScreen} />
          <Stack.Screen name="PatientDetailView" component={PatientDetailViewScreen} />
          <Stack.Screen name="MedicalRecord" component={MedicalRecordScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
        </>
      );

    case 'Admin':
      return (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="StaffList" component={StaffListScreen} />
          <Stack.Screen name="StaffDetails" component={StaffDetailsScreen} />
          <Stack.Screen name="AddStaff" component={AddStaffScreen} />
          <Stack.Screen name="ClinicManagement" component={ClinicManagementScreen} />
          <Stack.Screen name="ClinicDetailsScreen" component={AdminClinicDetailsScreen} />
          <Stack.Screen name="ServiceManagement" component={ServiceManagementScreen} />
          <Stack.Screen name="TimeSlotManagement" component={TimeSlotManagementScreen} />
          <Stack.Screen name="StaffProfile" component={StaffProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
        </>
      );

    case 'FirstResponder':
      return (
        <>
          <Stack.Screen name="FirstResponderHome" component={FirstResponderHomeScreen} />
          <Stack.Screen name="FirstResponderProfile" component={FirstResponderProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
        </>
      );

    default:
      return <Stack.Screen name="Login" component={LoginScreen} />;
  }
}

export default function AppNavigator() {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B7C5C" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (user && !role) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B7C5C" />
        <Text style={styles.loadingText}>Resolving account...</Text>
      </View>
    );
  }

  const initialRouteName: keyof RootStackParamList = user
    ? getHomeForRole(role)
    : 'Login';

  return (
    <Stack.Navigator screenOptions={screenOpts} initialRouteName={initialRouteName}>
      {user && role ? (
        <Stack.Group>{getRoleScreens(role)}</Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="StaffLogin" component={StaffLoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterStep1" component={RegisterStep1Screen} />
          <Stack.Screen name="RegisterStep2" component={RegisterStep2Screen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});