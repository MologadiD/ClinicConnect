// src/screens/appointments/SuccessScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingSuccess'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'BookingSuccess'>;

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuccessScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { clinicName, serviceName, date, startTime } = route.params || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerText}>SUCCESSFULLY BOOKED</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={56} color="#FFF" />
        </View>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.message}>
          Your appointment has been booked successfully.
        </Text>

        {(clinicName || serviceName || date) && (
          <View style={styles.detailsCard}>
            {serviceName ? (
              <Text style={styles.detailLine}>{serviceName}</Text>
            ) : null}
            {clinicName ? (
              <Text style={styles.detailSub}>{clinicName}</Text>
            ) : null}
            {date ? (
              <Text style={styles.detailSub}>
                {formatDate(date)}
                {startTime ? ` · ${startTime.slice(0, 5)}` : ''}
              </Text>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('PatientHome', {})}
        >
          <Text style={styles.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#d4b896',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    justifyContent: 'flex-end',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e2a3a',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6B7C5C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailsCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  detailLine: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  detailSub: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});