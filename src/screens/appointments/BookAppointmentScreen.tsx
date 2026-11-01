import React, { useState, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookAppointment'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'BookAppointment'>;

export default function BookAppointmentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { theme } = useTheme();
  const { clinicId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(
    clinicId && clinicId.length > 0 ? clinicId : null
  );

  useEffect(() => {
    if (clinicId && clinicId.length > 0) {
      fetchClinicDetails(clinicId);
    } else {
      fetchAllClinics();
    }
  }, [clinicId]);

  const fetchClinicDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClinic(data);
      setSelectedClinicId(data.id);
    } catch (error) {
      console.error('Error fetching clinic:', error);
      Alert.alert('Error', 'Failed to load clinic details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClinics = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('status', 'active')
        .order('clinic_name');

      if (error) throw error;
      setClinics(data || []);
      if (data && data.length > 0 && !selectedClinicId) {
        setSelectedClinicId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching clinics:', error);
      Alert.alert('Error', 'Failed to load clinics');
    } finally {
      setLoading(false);
    }
  };

  const goToServices = (id: string, name?: string) => {
    navigation.navigate('SelectService', {
      clinicId: id,
      clinicName: name,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {clinic ? (
          <View>
            <View style={styles.clinicCard}>
              <View style={styles.clinicIconWrap}>
                <Ionicons name="business" size={28} color="#6B7C5C" />
              </View>
              <Text style={styles.clinicName}>{clinic.clinic_name}</Text>
              <Text style={styles.clinicAddress}>
                {clinic.address || clinic.location || 'Address not available'}
              </Text>
              {clinic.phone ? (
                <Text style={styles.clinicPhone}>{clinic.phone}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => goToServices(clinic.id, clinic.clinic_name)}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.selectClinic}>
            <Text style={styles.selectTitle}>Select a Clinic</Text>
            <Text style={styles.selectSubtitle}>
              Choose where you would like to book your appointment
            </Text>

            {clinics.length === 0 ? (
              <Text style={styles.emptyText}>No active clinics available</Text>
            ) : (
              clinics.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.clinicOption,
                    selectedClinicId === item.id && styles.clinicOptionSelected,
                  ]}
                  onPress={() => setSelectedClinicId(item.id)}
                >
                  <View style={styles.clinicOptionRow}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.clinicOptionName,
                          selectedClinicId === item.id && styles.clinicOptionNameSelected,
                        ]}
                      >
                        {item.clinic_name}
                      </Text>
                      <Text style={styles.clinicOptionAddress}>
                        {item.location || item.address || ''}
                      </Text>
                    </View>
                    {selectedClinicId === item.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#6B7C5C" />
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}

            {selectedClinicId && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => {
                  const selected = clinics.find((c) => c.id === selectedClinicId);
                  goToServices(selectedClinicId, selected?.clinic_name);
                }}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
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
  clinicCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  clinicIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F4EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  clinicName: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', textAlign: 'center' },
  clinicAddress: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
  clinicPhone: { fontSize: 14, color: '#666', marginTop: 4 },
  selectClinic: { flex: 1 },
  selectTitle: { fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  selectSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  clinicOption: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  clinicOptionSelected: {
    borderColor: '#6B7C5C',
    backgroundColor: '#F0F4EC',
  },
  clinicOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clinicOptionName: { fontSize: 16, fontWeight: '500', color: '#1a1a1a' },
  clinicOptionNameSelected: { color: '#6B7C5C' },
  clinicOptionAddress: { fontSize: 13, color: '#666', marginTop: 2 },
  continueButton: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    marginTop: 24,
  },
});