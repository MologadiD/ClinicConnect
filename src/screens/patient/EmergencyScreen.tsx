import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const EMERGENCY_TYPES = [
  'Medical',
  'Injury/accident',
  'Chest pain',
  'Breathing difficult',
  'Unconscious',
  'Other',
];

const EmergencyScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedType, setSelectedType] = useState('Medical');
  const [details, setDetails] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);

  const savedAddress = '14 Main Rd, Langa, Cape Town';

  const handleSOS = () => {
    navigation.navigate('EmergencySuccess');
  };

  const handleSendAlert = () => {
    navigation.navigate('EmergencySuccess');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={['#B08968', '#F4F7F6']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AS</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>Emergency</Text>
        <Text style={styles.headerSub}>Report a medical emergency</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color="#C0392B" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Use for real emergencies only</Text>
            <Text style={styles.warningSub}>
              This will immediately alert clinic staff and emergency responders
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addressRow, !useCurrentLocation && styles.addressRowSelected]}
          onPress={() => setUseCurrentLocation(false)}
        >
          <Ionicons name="location" size={16} color="#1A1A1A" />
          <Text style={styles.addressText}>Your address: {savedAddress}</Text>
        </TouchableOpacity>

        <Text style={styles.orText}>or</Text>

        <TouchableOpacity
          style={[styles.addressRow, useCurrentLocation && styles.addressRowSelected]}
          onPress={() => setUseCurrentLocation(true)}
        >
          <Ionicons name="navigate" size={16} color="#1A1A1A" />
          <Text style={styles.addressText}>Share your current location</Text>
        </TouchableOpacity>

        <View style={styles.sosWrapper}>
          <TouchableOpacity style={styles.sosButton} onPress={handleSOS} activeOpacity={0.85}>
            <Ionicons name="alert-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
          <Text style={styles.sosCaption}>Tap to alert emergency services instantly</Text>
        </View>

        <Text style={styles.sectionLabel}>Emergency type</Text>
        <View style={styles.typeGrid}>
          {EMERGENCY_TYPES.map((type) => {
            const selected = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, selected && styles.typeChipSelected]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Additional details (optional)</Text>
        <TextInput
          style={styles.detailsInput}
          placeholder="Describe the situation briefly..."
          placeholderTextColor="#AAAAAA"
          multiline
          numberOfLines={4}
          value={details}
          onChangeText={setDetails}
        />

        <TouchableOpacity style={styles.sendButton} onPress={handleSendAlert} activeOpacity={0.85}>
          <Text style={styles.sendButtonText}>Send emergency alert</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F6' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  headerSub: {
    fontSize: 13,
    color: '#FFFFFFCC',
    marginTop: 2,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F5C6C0',
    padding: 12,
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#C0392B' },
  warningSub: { fontSize: 12, color: '#C0392B', marginTop: 2 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addressRowSelected: {
    borderColor: '#7B1D1D',
    borderWidth: 1.5,
  },
  addressText: { fontSize: 13, color: '#1A1A1A', marginLeft: 8 },
  orText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
    marginVertical: 10,
  },
  sosWrapper: {
    alignItems: 'center',
    marginVertical: 24,
  },
  sosButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#C0392B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16, marginTop: 2 },
  sosCaption: {
    fontSize: 12,
    color: '#666666',
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D3A2B',
    marginBottom: 10,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  typeChipSelected: {
    backgroundColor: '#2D3A5C',
    borderColor: '#2D3A5C',
  },
  typeChipText: { fontSize: 12, color: '#555555' },
  typeChipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  detailsInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 12,
    fontSize: 13,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 22,
  },
  sendButton: {
    backgroundColor: '#C0392B',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: { color: '#888888', fontSize: 13 },
});

export default EmergencyScreen;