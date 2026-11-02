// src/screens/appointments/AppointmentDetailScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase/client';
import { RootStackParamList } from '../../navigation/types';
import PrescriptionList from '../../components/PrescriptionList';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AppointmentDetail'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'AppointmentDetail'>;

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  booked: { label: 'Booked', bg: '#E3F2FD', text: '#1565C0' },
  confirmed: { label: 'Confirmed', bg: '#E8F5E9', text: '#2E7D32' },
  completed: { label: 'Completed', bg: '#F3E5F5', text: '#7B1FA2' },
  cancelled: { label: 'Cancelled', bg: '#FFEBEE', text: '#C62828' },
  no_show: { label: 'No Show', bg: '#FFF3E0', text: '#E65100' },
};

export default function AppointmentDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { appointmentId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [appointment, setAppointment] = useState<any>(null);

  const fetchAppointment = useCallback(async () => {
    if (!appointmentId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          reason_for_visit,
          status,
          notes,
          created_at,
          clinic:clinics (
            clinic_name,
            location,
            address,
            phone
          ),
          service:services (
            service_name,
            estimated_duration
          ),
          time_slot:time_slots (
            id,
            date,
            start_time,
            end_time
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data);
    } catch (err) {
      console.error('Error loading appointment:', err);
      Alert.alert('Error', 'Could not load appointment details');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointment();
    }, [fetchAppointment])
  );

  const canCancel =
    appointment &&
    (appointment.status === 'booked' || appointment.status === 'confirmed');

  const handleCancel = () => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const { error } = await supabase
                .from('appointments')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', appointmentId);

              if (error) throw error;

              const slotId = appointment?.time_slot?.id;
              if (slotId) {
                const { data: slot } = await supabase
                  .from('time_slots')
                  .select('booked_count, max_patients')
                  .eq('id', slotId)
                  .single();
                if (slot) {
                  const newCount = Math.max(0, (slot.booked_count ?? 1) - 1);
                  await supabase
                    .from('time_slots')
                    .update({
                      booked_count: newCount,
                      is_available: true,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', slotId);
                }
              }

              Alert.alert('Cancelled', 'Your appointment has been cancelled.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel appointment');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Appointment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Appointment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_STYLE[appointment.status] || STATUS_STYLE.booked;
  const dateStr = appointment.time_slot?.date
    ? new Date(appointment.time_slot.date + 'T00:00:00').toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date TBC';
  const timeStr = appointment.time_slot?.start_time
    ? `${appointment.time_slot.start_time.slice(0, 5)}${
        appointment.time_slot.end_time
          ? ` – ${appointment.time_slot.end_time.slice(0, 5)}`
          : ''
      }`
    : 'Time TBC';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.text }]}>
            {statusCfg.label}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.reason}>
            {appointment.reason_for_visit ||
              appointment.service?.service_name ||
              'Consultation'}
          </Text>

          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={20} color="#6B7C5C" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Clinic</Text>
              <Text style={styles.detailValue}>
                {appointment.clinic?.clinic_name || '—'}
              </Text>
              {(appointment.clinic?.location || appointment.clinic?.address) && (
                <Text style={styles.detailSub}>
                  {appointment.clinic?.location || appointment.clinic?.address}
                </Text>
              )}
            </View>
          </View>

          {appointment.service?.service_name && (
            <View style={styles.detailRow}>
              <Ionicons name="medkit-outline" size={20} color="#6B7C5C" />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>
                  {appointment.service.service_name}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color="#6B7C5C" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{dateStr}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={20} color="#6B7C5C" />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{timeStr}</Text>
            </View>
          </View>
        </View>

        <PrescriptionList appointmentId={appointmentId} title="Prescriptions" hideWhenEmpty />

        {canCancel && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#C62828" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color="#C62828" />
                <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  emptyText: { fontSize: 15, color: '#888' },
  content: { padding: 16 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  reason: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailText: { flex: 1 },
  detailLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  detailSub: { fontSize: 13, color: '#666', marginTop: 2 },
  cancelBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C62828',
  },
});