import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase/client';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import PrescriptionList from '../../components/PrescriptionList';

export default function PatientDetailViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { theme } = useTheme();
  const { patientId } = (route.params as { patientId: string }) || {};
  const { role } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [saving, setSaving] = useState(false);

  const canWrite = role === 'Doctor' || role === 'Nurse' || role === 'Admin';

  const load = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    try {
      const [{ data: p }, { data: r }, { data: a }] = await Promise.all([
        supabase.from('patients').select('*').eq('id', patientId).maybeSingle(),
        supabase
          .from('medical_records')
          .select('*')
          .eq('patient_id', patientId)
          .order('visit_date', { ascending: false })
          .limit(20),
        supabase
          .from('appointments')
          .select(
            `
            id, status, created_at,
            services ( service_name ),
            clinics ( clinic_name ),
            time_slots ( date, start_time, end_time )
          `
          )
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);
      setPatient(p);
      setRecords(r || []);
      setAppointments(a || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const saveRecord = async () => {
    if (!canWrite) {
      Alert.alert('Not allowed', 'Only clinical staff can add records');
      return;
    }
    if (!notes.trim() && !diagnosis.trim()) {
      Alert.alert('Required', 'Enter diagnosis or clinical notes');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('medical_records').insert({
        patient_id: patientId,
        visit_date: new Date().toISOString(),
        diagnosis_notes: diagnosis.trim() || notes.trim(),
        doctor_notes: notes.trim() || null,
        treatment_plan: treatment.trim() || null,
      });
      if (error) throw error;
      setNotes('');
      setDiagnosis('');
      setTreatment('');
      await load();
      Alert.alert('Saved', 'Medical record added');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#6B7C5C" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ color: '#888' }}>Patient not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: '#6B7C5C', fontWeight: '600', marginTop: 8 }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.4]}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Patient</Text>
          {role === 'Doctor' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('DoctorMedicalRecord', { patientId })}
            >
              <Ionicons name="add-circle-outline" size={24} color="#6B7C5C" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.name}>
              {patient.first_name} {patient.last_name}
            </Text>
            <Meta label="ID number" value={patient.id_number} />
            <Meta label="Gender" value={patient.gender} />
            <Meta label="Date of birth" value={patient.date_of_birth} />
            <Meta label="Phone" value={patient.contact_number} />
            <Meta label="Email" value={patient.email} />
            <Meta
              label="Next of kin"
              value={
                patient.next_of_kin_name
                  ? `${patient.next_of_kin_name}${
                      patient.next_of_kin_relation ? ` (${patient.next_of_kin_relation})` : ''
                    }${patient.next_of_kin_contact ? ` · ${patient.next_of_kin_contact}` : ''}`
                  : null
              }
            />
            <Meta label="Medical aid" value={patient.medical_aid_plan || patient.medical_aid_number} />

            {patient.contact_number ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${patient.contact_number}`)}
              >
                <Ionicons name="call" size={16} color="#FFF" />
                <Text style={styles.callText}>Call patient</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {canWrite && (
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Text style={styles.section}>Add clinical note</Text>
              <TextInput
                style={styles.input}
                placeholder="Diagnosis"
                value={diagnosis}
                onChangeText={setDiagnosis}
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Clinical notes"
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="Treatment plan (optional)"
                value={treatment}
                onChangeText={setTreatment}
                multiline
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveRecord}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save record'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.section, { marginHorizontal: 4 }]}>Appointments</Text>
          {appointments.length === 0 ? (
            <Text style={styles.empty}>No appointments</Text>
          ) : (
            appointments.map((a) => (
              <View key={a.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={styles.date}>
                  {a.time_slots?.date ||
                    (a.created_at ? new Date(a.created_at).toLocaleDateString('en-ZA') : '—')}
                  {a.time_slots?.start_time ? ` · ${a.time_slots.start_time}` : ''}
                </Text>
                <Text style={styles.note}>
                  {a.services?.service_name || 'Visit'} · {a.clinics?.clinic_name || 'Clinic'} ·{' '}
                  {a.status}
                </Text>
              </View>
            ))
          )}

          <Text style={[styles.section, { marginHorizontal: 4 }]}>Prescriptions</Text>
          <PrescriptionList
            patientId={patientId}
            patientName={`${patient.first_name || ''} ${patient.last_name || ''}`.trim()}
            canCancel={role === 'Doctor'}
          />

          <Text style={[styles.section, { marginHorizontal: 4 }]}>Medical records</Text>
          {records.length === 0 ? (
            <Text style={styles.empty}>No records yet</Text>
          ) : (
            records.map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={styles.date}>
                  {r.visit_date
                    ? new Date(r.visit_date).toLocaleString('en-ZA')
                    : r.created_at
                      ? new Date(r.created_at).toLocaleString('en-ZA')
                      : '—'}
                </Text>
                {r.diagnosis_notes ? (
                  <Text style={styles.note}>
                    <Text style={styles.bold}>Diagnosis: </Text>
                    {r.diagnosis_notes}
                  </Text>
                ) : null}
                {r.doctor_notes ? (
                  <Text style={styles.note}>
                    <Text style={styles.bold}>Notes: </Text>
                    {r.doctor_notes}
                  </Text>
                ) : null}
                {r.treatment_plan ? (
                  <Text style={styles.note}>
                    <Text style={styles.bold}>Plan: </Text>
                    {r.treatment_plan}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 11, color: '#999', fontWeight: '600' }}>{label}</Text>
      <Text style={{ fontSize: 14, color: '#222', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#222', marginBottom: 4 },
  section: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#FAFAFA',
  },
  saveBtn: {
    backgroundColor: '#6B7C5C',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  saveText: { color: '#FFF', fontWeight: '700' },
  callBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6B7C5C',
    padding: 12,
    borderRadius: 10,
  },
  callText: { color: '#FFF', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#999', marginVertical: 12 },
  date: { fontSize: 11, color: '#999', marginBottom: 6 },
  note: { fontSize: 14, color: '#333', marginBottom: 4, lineHeight: 20 },
  bold: { fontWeight: '700' },
});
