// src/screens/appointments/ConfirmBookingScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase/client';
import { markSlotBooked } from '../../services/slots';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConfirmBooking'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'ConfirmBooking'>;

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ConfirmBookingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { profile, user } = useAuth();
  const {
    clinicId,
    clinicName,
    serviceId,
    serviceName,
    timeSlotId,
    date,
    startTime,
    endTime,
  } = route.params;

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to book an appointment');
      return;
    }

    setSubmitting(true);
    try {
      let patientId = profile?.id;
      if (!patientId) {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (patientError || !patientData) {
          throw new Error('Patient profile not found. Please complete your profile first.');
        }
        patientId = patientData.id;
      }

      // One appointment per patient per day
      const { data: sameDayAppts } = await supabase
        .from('appointments')
        .select('id, time_slots!inner ( date )')
        .eq('patient_id', patientId)
        .in('status', ['booked', 'confirmed'])
        .eq('time_slots.date', date);

      if (sameDayAppts && sameDayAppts.length > 0) {
        throw new Error(
          'You already have an appointment on this day. Only one booking per day is allowed.'
        );
      }

      // Refuse if this slot is already full / unavailable for the day
      const { data: slotCheck, error: slotCheckErr } = await supabase
        .from('time_slots')
        .select('id, is_available, booked_count, max_patients')
        .eq('id', timeSlotId)
        .maybeSingle();

      if (slotCheckErr) throw slotCheckErr;
      if (
        !slotCheck ||
        !slotCheck.is_available ||
        (slotCheck.booked_count ?? 0) >= (slotCheck.max_patients ?? 1)
      ) {
        throw new Error(
          'This time slot is no longer available for the day. Please go back and choose another time.'
        );
      }

      // Also block if another active appointment already sits on this slot
      const { count: existingAppts } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('time_slot_id', timeSlotId)
        .in('status', ['booked', 'confirmed']);

      if ((existingAppts ?? 0) >= (slotCheck.max_patients ?? 1)) {
        // Keep DB consistent
        await supabase
          .from('time_slots')
          .update({
            is_available: false,
            booked_count: existingAppts ?? 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', timeSlotId);
        throw new Error(
          'This time slot was just booked by someone else. Please choose another time.'
        );
      }

      const { error: apptError } = await supabase
        .from('appointments')
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
          service_id: serviceId,
          time_slot_id: timeSlotId,
          reason_for_visit: reason.trim() || serviceName || 'General consultation',
          status: 'booked',
        })
        .select()
        .single();

      if (apptError) throw apptError;

      // Mark slot unavailable for the day (and roll same time to next day)
      await markSlotBooked(timeSlotId);

      navigation.replace('BookingSuccess', {
        clinicName,
        serviceName,
        date,
        startTime,
      });
    } catch (err: any) {
      console.error('Booking error:', err);
      Alert.alert('Booking Failed', err.message || 'Could not complete your booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Appointment Summary</Text>

            <View style={styles.row}>
              <Ionicons name="business-outline" size={20} color="#6B7C5C" />
              <View style={styles.rowText}>
                <Text style={styles.label}>Clinic</Text>
                <Text style={styles.value}>{clinicName || 'Selected clinic'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Ionicons name="medkit-outline" size={20} color="#6B7C5C" />
              <View style={styles.rowText}>
                <Text style={styles.label}>Service</Text>
                <Text style={styles.value}>{serviceName || 'Selected service'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Ionicons name="calendar-outline" size={20} color="#6B7C5C" />
              <View style={styles.rowText}>
                <Text style={styles.label}>Date</Text>
                <Text style={styles.value}>{formatDate(date)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Ionicons name="time-outline" size={20} color="#6B7C5C" />
              <View style={styles.rowText}>
                <Text style={styles.label}>Time</Text>
                <Text style={styles.value}>
                  {startTime?.slice(0, 5)}
                  {endTime ? ` – ${endTime.slice(0, 5)}` : ''}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.inputLabel}>Reason for visit (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Follow-up, flu symptoms..."
            placeholderTextColor="#999"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.confirmButtonText}>Confirm Booking</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  content: { padding: 16, flexGrow: 1 },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  rowText: { flex: 1 },
  label: { fontSize: 12, color: '#888', marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    minHeight: 90,
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});