import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase/client';
import { useTheme } from '../../context/ThemeContext';

export default function DoctorMedicalRecordScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const params = (route.params as { patientId?: string }) || {};
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [treatment, setTreatment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!params.patientId) {
      Alert.alert('Error', 'No patient selected');
      return;
    }
    if (!diagnosis.trim() && !notes.trim()) {
      Alert.alert('Required', 'Enter a diagnosis or notes');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('medical_records').insert({
        patient_id: params.patientId,
        visit_date: new Date().toISOString(),
        diagnosis_notes: diagnosis.trim() || notes.trim(),
        doctor_notes: notes.trim() || null,
        treatment_plan: treatment.trim() || null,
      });
      if (error) throw error;
      Alert.alert('Saved', 'Medical record created', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#B08968', '#FFFFFF', '#FFFFFF']} locations={[0, 0.15, 0.4]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>New medical record</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.label}>Diagnosis</Text>
          <TextInput style={styles.input} value={diagnosis} onChangeText={setDiagnosis} placeholderTextColor="#999" placeholder="Primary diagnosis" />
          <Text style={styles.label}>Clinical notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Observations, vitals summary..."
            placeholderTextColor="#999"
          />
          <Text style={styles.label}>Treatment plan</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={treatment}
            onChangeText={setTreatment}
            multiline
            placeholder="Medication, follow-up..."
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save record'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 12, borderWidth: 1,
    borderColor: '#E0E0E0', fontSize: 15, color: '#222',
  },
  btn: {
    backgroundColor: '#6B7C5C', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24,
  },
  btnText: { color: '#FFF', fontWeight: '700' },
});
