import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function PatientProfileScreen() {
  const navigation = useNavigation();
  const { profile, updateProfile, logout, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    contact_number: profile?.contact_number || '',
    next_of_kin_name: profile?.next_of_kin_name || '',
    next_of_kin_contact: profile?.next_of_kin_contact || '',
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfile(form);
      setEditing(false);
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout().catch(() => Alert.alert('Error', 'Failed to sign out')),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity onPress={() => (editing ? handleSave() : setEditing(true))}>
          <Text style={styles.editBtn}>{editing ? (saving ? 'Saving...' : 'Save') : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>
            {(profile?.first_name?.[0] || 'P') + (profile?.last_name?.[0] || '')}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email || profile?.email}</Text>

        {(['first_name', 'last_name', 'contact_number', 'next_of_kin_name', 'next_of_kin_contact'] as const).map(
          (key) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>
                {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key]: t }))}
                  editable={!saving}
                />
              ) : (
                <Text style={styles.value}>{(profile as any)?.[key] || '—'}</Text>
              )}
            </View>
          )
        )}

        <TouchableOpacity
          style={styles.prefs}
          onPress={() => navigation.navigate('NotificationPreferences' as any)}
        >
          <Ionicons name="notifications-outline" size={20} color="#2E7D32" />
          <Text style={styles.prefsText}>Notification preferences</Text>
          <Ionicons name="chevron-forward" size={18} color="#9E9E9E" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#C62828" />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { padding: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 4 },
  editBtn: { color: '#2E7D32', fontWeight: '700', padding: 8 },
  body: { padding: 20, paddingBottom: 40 },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D32',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '700' },
  email: { textAlign: 'center', color: '#757575', marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, color: '#9E9E9E', marginBottom: 4, fontWeight: '600' },
  value: { fontSize: 15, color: '#212121', backgroundColor: '#FFF', padding: 12, borderRadius: 8 },
  input: {
    fontSize: 15,
    color: '#212121',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
  },
  prefs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 10,
  },
  prefsText: { flex: 1, fontWeight: '600', color: '#212121' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
    padding: 12,
  },
  logoutText: { color: '#C62828', fontWeight: '600' },
});
