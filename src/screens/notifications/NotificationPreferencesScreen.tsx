import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation();
  const { profile, updateProfile } = useAuth();
  const prefs = profile?.notification_preference || {};
  const [sms, setSms] = useState(!!prefs.sms);
  const [email, setEmail] = useState(!!prefs.email);
  const [inApp, setInApp] = useState(prefs.inApp !== false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({
        notification_preference: { sms, email, inApp },
      });
      Alert.alert('Saved', 'Notification preferences updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#212121" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification preferences</Text>
      </View>
      <View style={styles.body}>
        {[
          { label: 'SMS', value: sms, set: setSms },
          { label: 'Email', value: email, set: setEmail },
          { label: 'In-app', value: inApp, set: setInApp },
        ].map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={row.value}
              onValueChange={row.set}
              trackColor={{ true: '#2E7D32', false: '#BDBDBD' }}
            />
          </View>
        ))}
        <TouchableOpacity
          style={[styles.save, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save preferences'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  title: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
  body: { padding: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  label: { fontSize: 15, fontWeight: '600', color: '#212121' },
  save: {
    backgroundColor: '#2E7D32',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveText: { color: '#FFF', fontWeight: '700' },
});
