// src/screens/appointments/SelectServiceScreen.tsx
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
import { supabase } from '../../services/supabase/client';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SelectService'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'SelectService'>;

interface ServiceItem {
  id: string;
  service_name: string;
  description: string | null;
  estimated_duration: string | null;
  price: number | null;
}

export default function SelectServiceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { clinicId, clinicName } = route.params;

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, [clinicId]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('id, service_name, description, estimated_duration, price')
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .order('service_name');

      if (error) throw error;
      setServices(data || []);
      if (data && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedId) return;
    const service = services.find((s) => s.id === selectedId);
    navigation.navigate('SelectTimeSlot', {
      clinicId,
      clinicName,
      serviceId: selectedId,
      serviceName: service?.service_name,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Service</Text>
        <View style={{ width: 40 }} />
      </View>

      {clinicName ? (
        <Text style={styles.subtitle}>{clinicName}</Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading services...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.selectTitle}>What do you need?</Text>
          <Text style={styles.selectSubtitle}>
            Choose a service for your appointment
          </Text>

          {services.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="medkit-outline" size={40} color="#A8A8A8" />
              <Text style={styles.emptyText}>No services available at this clinic</Text>
            </View>
          ) : (
            services.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.option,
                  selectedId === item.id && styles.optionSelected,
                ]}
                onPress={() => setSelectedId(item.id)}
              >
                <View style={styles.optionRow}>
                  <View style={[styles.iconWrap, selectedId === item.id && styles.iconWrapSelected]}>
                    <Ionicons
                      name="medkit-outline"
                      size={22}
                      color={selectedId === item.id ? '#6B7C5C' : '#666'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.optionName,
                        selectedId === item.id && styles.optionNameSelected,
                      ]}
                    >
                      {item.service_name}
                    </Text>
                    {item.description ? (
                      <Text style={styles.optionDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      {item.estimated_duration ? (
                        <Text style={styles.metaText}>{item.estimated_duration}</Text>
                      ) : null}
                      {item.price != null ? (
                        <Text style={styles.metaText}>R {Number(item.price).toFixed(0)}</Text>
                      ) : null}
                    </View>
                  </View>
                  {selectedId === item.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#6B7C5C" />
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}

          {selectedId && services.length > 0 && (
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
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
  subtitle: {
    textAlign: 'center',
    color: '#6B7C5C',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  content: { padding: 16, flexGrow: 1 },
  selectTitle: { fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  selectSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  option: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  optionSelected: {
    borderColor: '#6B7C5C',
    backgroundColor: '#F0F4EC',
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: '#E0E8D8' },
  optionName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  optionNameSelected: { color: '#6B7C5C' },
  optionDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaText: { fontSize: 12, color: '#888' },
  continueButton: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
});