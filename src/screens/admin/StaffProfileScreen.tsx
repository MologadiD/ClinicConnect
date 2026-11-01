import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function StaffProfileScreen() {
  const navigation = useNavigation();
  const { staffProfile, user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.title}>Staff profile</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(staffProfile?.first_name?.[0] || 'S') + (staffProfile?.last_name?.[0] || '')}
          </Text>
        </View>
        <Text style={styles.name}>
          {staffProfile?.first_name} {staffProfile?.last_name}
        </Text>
        <Text style={styles.meta}>{staffProfile?.role}</Text>
        <Text style={styles.meta}>{user?.email}</Text>
        <Text style={styles.meta}>{staffProfile?.contact_number || 'No phone'}</Text>
        <TouchableOpacity
          style={styles.logout}
          onPress={() =>
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={18} color="#C62828" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
  body: { alignItems: 'center', padding: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6B7C5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  meta: { color: '#757575', marginTop: 4 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 32 },
  logoutText: { color: '#C62828', fontWeight: '600' },
});
