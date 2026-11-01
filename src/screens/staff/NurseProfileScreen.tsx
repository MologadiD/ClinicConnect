import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';

export default function NurseProfileScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('staff')
        .select(
          `id, staff_reg_number, first_name, last_name, email, contact_number, role,
           department, specialization, license_number, status, clinics ( clinic_name )`
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setStaff(
        data
          ? {
              ...data,
              clinic_name: (data as any).clinics?.clinic_name || null,
            }
          : null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const name = `${staff?.first_name || ''} ${staff?.last_name || ''}`.trim() || 'Nurse';
  const initials = `${staff?.first_name?.[0] || 'N'}${staff?.last_name?.[0] || ''}`.toUpperCase();

  const fields = [
    { label: 'Staff ID', value: staff?.staff_reg_number, icon: 'card-outline' as const },
    { label: 'Email', value: staff?.email || user?.email, icon: 'mail-outline' as const },
    { label: 'Phone', value: staff?.contact_number, icon: 'call-outline' as const },
    { label: 'Department', value: staff?.department, icon: 'layers-outline' as const },
    { label: 'Clinic', value: staff?.clinic_name, icon: 'business-outline' as const },
    { label: 'License', value: staff?.license_number, icon: 'document-text-outline' as const },
    { label: 'Status', value: staff?.status, icon: 'checkmark-circle-outline' as const },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient colors={['#B08968', '#FFFFFF', '#FFFFFF']} locations={[0, 0.2, 0.5]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color="#6B7C5C" size="large" /></View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={['#6B7C5C']} />
            }
          >
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
              <Text style={[styles.name, { color: theme.colors.text }]}>{name}</Text>
              <Text style={styles.role}>Nurse</Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.colors.surface, alignItems: 'stretch' }]}>
              {fields.filter((f) => f.value).map((f) => (
                <View key={f.label} style={styles.row}>
                  <Ionicons name={f.icon} size={18} color="#00838F" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{f.label}</Text>
                    <Text style={styles.value}>{f.value}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.logout}
              onPress={() =>
                Alert.alert('Sign out', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => logout() },
                ])
              }
            >
              <Ionicons name="log-out-outline" size={18} color="#E53935" />
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16 },
  card: {
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E8E8E8',
    marginBottom: 12, alignItems: 'center',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#00838F',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  role: { marginTop: 4, color: '#00838F', fontWeight: '600' },
  row: {
    flexDirection: 'row', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  label: { fontSize: 11, color: '#999', fontWeight: '600' },
  value: { fontSize: 14, color: '#222', marginTop: 2 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E8E8E8',
  },
  logoutText: { color: '#E53935', fontWeight: '700' },
});
