import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { prescriptionsApi, MedicationItem } from '../../services/api/prescriptions';
import { addDays, toDateString } from '../../services/slots';
import { notify } from '../../utils/dialogs';

type Route = RouteProp<RootStackParamList, 'WritePrescription'>;

const blankMed = (): MedicationItem => ({
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
});

// Quick picks only. The doctor must choose a validity period explicitly.
const VALIDITY_CHOICES = [7, 14, 30, 90];

export default function WritePrescriptionScreen() {
  const navigation = useNavigation<any>();
  const { params } = useRoute<Route>();
  const { appointmentId, patientId, patientName } = params;
  const { role, staffProfile } = useAuth();

  const [meds, setMeds] = useState<MedicationItem[]>([blankMed()]);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const updateMed = (i: number, field: keyof MedicationItem, value: string) =>
    setMeds((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));

  const submit = async () => {
    if (!staffProfile?.id) {
      notify('Cannot issue prescription', 'Your staff profile could not be found.');
      return;
    }
    try {
      setSaving(true);
      await prescriptionsApi.create(
        {
          patient_id: patientId,
          appointment_id: appointmentId,
          doctor_id: staffProfile.id,
          medications: meds,
          diagnosis,
          notes,
          valid_until: validUntil,
        },
        role
      );
      notify('Prescription issued', 'The patient can view and download it from their appointment.');
      navigation.goBack();
    } catch (e: any) {
      notify('Could not issue prescription', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>New prescription</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (role !== 'Doctor') {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <Text style={styles.denied}>Only doctors can issue prescriptions.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.15, 0.45]}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {header}
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {patientName ? <Text style={styles.patient}>Patient: {patientName}</Text> : null}
            <Text style={styles.hint}>
              This prescription is tied to this visit only. Once issued it cannot be edited: cancel it
              and issue a new one instead.
            </Text>

            <Text style={styles.label}>Diagnosis</Text>
            <TextInput
              style={styles.input}
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder="Optional"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.section}>Medications</Text>
            {meds.map((m, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Medication {i + 1}</Text>
                  {meds.length > 1 ? (
                    <TouchableOpacity onPress={() => setMeds((p) => p.filter((_, idx) => idx !== i))}>
                      <Ionicons name="trash-outline" size={18} color="#C62828" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TextInput
                  style={styles.input}
                  value={m.name}
                  onChangeText={(v) => updateMed(i, 'name', v)}
                  placeholder="Name *"
                  placeholderTextColor="#aaa"
                />
                <TextInput
                  style={styles.input}
                  value={m.dosage}
                  onChangeText={(v) => updateMed(i, 'dosage', v)}
                  placeholder="Dosage * (e.g. 500 mg)"
                  placeholderTextColor="#aaa"
                />
                <TextInput
                  style={styles.input}
                  value={m.frequency}
                  onChangeText={(v) => updateMed(i, 'frequency', v)}
                  placeholder="Frequency * (e.g. 3 times a day)"
                  placeholderTextColor="#aaa"
                />
                <TextInput
                  style={styles.input}
                  value={m.duration}
                  onChangeText={(v) => updateMed(i, 'duration', v)}
                  placeholder="Duration * (e.g. 7 days)"
                  placeholderTextColor="#aaa"
                />
                <TextInput
                  style={styles.input}
                  value={m.instructions || ''}
                  onChangeText={(v) => updateMed(i, 'instructions', v)}
                  placeholder="Instructions (optional)"
                  placeholderTextColor="#aaa"
                />
              </View>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={() => setMeds((p) => [...p, blankMed()])}>
              <Ionicons name="add-circle-outline" size={18} color="#6B7C5C" />
              <Text style={styles.addText}>Add medication</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Valid until *</Text>
            <TextInput
              style={styles.input}
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
            />
            <View style={styles.chips}>
              {VALIDITY_CHOICES.map((days) => (
                <TouchableOpacity
                  key={days}
                  style={styles.chip}
                  onPress={() => setValidUntil(addDays(toDateString(new Date()), days))}
                >
                  <Text style={styles.chipText}>+{days} days</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional"
              placeholderTextColor="#aaa"
              multiline
            />

            <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>Issue prescription</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  denied: { padding: 24, color: '#C62828', fontSize: 15 },
  content: { padding: 16, paddingBottom: 40 },
  patient: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  hint: { fontSize: 12, color: '#666', marginBottom: 14 },
  section: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginTop: 8, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#555' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  addText: { color: '#6B7C5C', fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6B7C5C',
  },
  chipText: { color: '#6B7C5C', fontSize: 12, fontWeight: '600' },
  submit: {
    marginTop: 20,
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
