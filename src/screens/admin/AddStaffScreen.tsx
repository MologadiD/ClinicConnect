// src/screens/admin/AddStaffScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Input } from '../../components/Input';
import { Dropdown } from '../../components/Dropdown';
import { Button } from '../../components/Button';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';
import { adminActionsClient } from '../../services/supabase/adminActionsClient';

type StaffRole = 'Doctor' | 'Nurse' | 'Admin' | 'FirstResponder';

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  role: StaffRole | '';
  specialization: string;
  licenseNumber: string;
  department: string;
  responseUnit: string;
  ambulanceNumber: string;
  clinicId: string;
}

const ROLES = ['Doctor', 'Nurse', 'Admin', 'FirstResponder'] as const;

// Clinical and ancillary departments a staff member can be assigned to.
const DEPARTMENTS = [
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

// Every doctor added through this screen is a General Practitioner.
const GP_SPECIALIZATION = 'General Practitioner (GP)';

export default function AddStaffScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [form, setForm] = useState<StaffFormData>({
    firstName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    role: '',
    specialization: GP_SPECIALIZATION,
    licenseNumber: '',
    department: '',
    responseUnit: '',
    ambulanceNumber: '',
    clinicId: '',
  });

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);
      const { data, error } = await supabase
        .from('clinics')
        .select('id, clinic_name')
        .eq('status', 'active');

      if (error) {
        console.error('Supabase error fetching clinics:', error);
        throw error;
      }

      const fetchedClinics = data?.map(c => ({ id: c.id, name: c.clinic_name })) || [];
      setClinics(fetchedClinics);
    } catch (error) {
      console.error('Failed to fetch clinics:', error);
      Alert.alert('Error', 'Unable to load clinics list. Please check database permissions.');
    } finally {
      setLoadingClinics(false);
    }
  };

  const clinicOptions = clinics.map(c => c.name);
  const clinicMap = clinics.reduce((acc, c) => ({ ...acc, [c.name]: c.id }), {} as Record<string, string>);
  
  // Find current clinic name corresponding to form.clinicId
  const selectedClinicName = clinics.find(c => c.id === form.clinicId)?.name || '';

  const updateField = (field: keyof StaffFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
    if (!form.role) newErrors.role = 'Please select a role';
    if (!form.clinicId) newErrors.clinicId = 'Please select a clinic';

    if (form.role === 'Doctor' && !form.licenseNumber.trim()) {
      newErrors.licenseNumber = 'License number is required';
    }
    if ((form.role === 'Doctor' || form.role === 'Nurse') && !form.department) {
      newErrors.department = 'Please select a department';
    }
    if (form.role === 'FirstResponder') {
      if (!form.responseUnit.trim()) newErrors.responseUnit = 'Response unit is required';
      if (!form.ambulanceNumber.trim()) newErrors.ambulanceNumber = 'Ambulance number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

      const { data: authData, error: authError } = await adminActionsClient.auth.signUp({
        email: form.email,
        password: tempPassword,
      });

      await adminActionsClient.auth.signOut().catch(() => {});

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const staffRegNumber = `STF-${Date.now().toString().slice(-6)}`;
      const staffData: any = {
        user_id: authData.user.id,
        staff_reg_number: staffRegNumber,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        contact_number: form.contactNumber,
        role: form.role,
        clinic_id: form.clinicId,
        status: 'active',
      };

      if (form.role === 'Doctor') {
        staffData.specialization = GP_SPECIALIZATION;
        staffData.license_number = form.licenseNumber;
        staffData.department = form.department;
      }
      if (form.role === 'Nurse') {
        staffData.department = form.department;
      }
      if (form.role === 'FirstResponder') {
        staffData.response_unit = form.responseUnit;
        staffData.ambulance_number = form.ambulanceNumber;
      }

      const { error: staffError } = await supabase
        .from('staff')
        .insert(staffData);

      if (staffError) throw staffError;

      Alert.alert(
        'Success',
        `Staff member added successfully!\n\nStaff ID: ${staffRegNumber}\nTemporary Password: ${tempPassword}\n\nShare both with the staff member — they'll sign in from the Staff Login screen and land on their ${form.role} dashboard automatically.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add staff member');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDepartmentField = () => (
    <Dropdown
      label="Department"
      value={form.department}
      options={DEPARTMENTS}
      onSelect={(v) => updateField('department', v)}
      error={errors.department}
    />
  );

  const renderRoleSpecificFields = () => {
    switch (form.role) {
      case 'Doctor':
        return (
          <>
            <Input
              label="Specialization"
              value={GP_SPECIALIZATION}
              editable={false}
            />
            {renderDepartmentField()}
            <Input
              label="License Number"
              value={form.licenseNumber}
              onChangeText={(v) => updateField('licenseNumber', v)}
              error={errors.licenseNumber}
              placeholder="e.g., SA-12345"
            />
          </>
        );
      case 'Nurse':
        return renderDepartmentField();
      case 'FirstResponder':
        return (
          <>
            <Input
              label="Response Unit"
              value={form.responseUnit}
              onChangeText={(v) => updateField('responseUnit', v)}
              error={errors.responseUnit}
              placeholder="e.g., ER-01"
            />
            <Input
              label="Ambulance Number"
              value={form.ambulanceNumber}
              onChangeText={(v) => updateField('ambulanceNumber', v)}
              error={errors.ambulanceNumber}
              placeholder="e.g., AMB-789"
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.5]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Add Staff Member</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Personal Information
              </Text>

              <Input
                label="First Name"
                value={form.firstName}
                onChangeText={(v) => updateField('firstName', v)}
                error={errors.firstName}
                autoCapitalize="words"
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChangeText={(v) => updateField('lastName', v)}
                error={errors.lastName}
                autoCapitalize="words"
              />
              <Input
                label="Email"
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Contact Number"
                value={form.contactNumber}
                onChangeText={(v) => updateField('contactNumber', v)}
                error={errors.contactNumber}
                keyboardType="phone-pad"
              />

              <Dropdown
                label="Role"
                value={form.role}
                options={ROLES}
                onSelect={(v) => updateField('role', v)}
                error={errors.role}
              />

              <Dropdown
                label="Clinic"
                value={selectedClinicName}
                options={loadingClinics ? [] : clinicOptions}
                onSelect={(selectedName) => {
                  const id = clinicMap[selectedName] || '';
                  updateField('clinicId', id);
                }}
                error={errors.clinicId}
              />

              {renderRoleSpecificFields()}
            </View>

            <Button
              title="Add Staff Member"
              onPress={handleSubmit}
              loading={isLoading}
              style={styles.submitButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  submitButton: { marginTop: 8 },
});