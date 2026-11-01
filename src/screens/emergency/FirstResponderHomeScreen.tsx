import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../services/supabase/client';
import { EmergencyAlert, EmergencyStatus, Priority } from '../../types';

type Tab = 'active' | 'history';

type AlertRow = EmergencyAlert & {
  patients?: {
    first_name?: string;
    last_name?: string;
    contact_number?: string | null;
    email?: string | null;
  } | null;
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#E53935',
  dispatched: '#FF9800',
  resolved: '#4CAF50',
  cancelled: '#9E9E9E',
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#B71C1C',
  high: '#E53935',
  medium: '#FB8C00',
  low: '#43A047',
};

function formatLocation(loc: EmergencyAlert['location']): string {
  if (!loc) return 'Location not provided';
  if (typeof loc === 'string') return loc;
  const o = loc as Record<string, unknown>;
  if (typeof o.address === 'string' && o.address) return o.address;
  if (o.latitude != null && o.longitude != null) {
    return `${Number(o.latitude).toFixed(5)}, ${Number(o.longitude).toFixed(5)}`;
  }
  return 'Location shared';
}

function mapsUrl(loc: EmergencyAlert['location']): string | null {
  if (!loc || typeof loc === 'string') return null;
  const o = loc as Record<string, unknown>;
  if (o.latitude != null && o.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${o.latitude},${o.longitude}`;
  }
  if (typeof o.address === 'string' && o.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`;
  }
  return null;
}

export default function FirstResponderHomeScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { staffProfile, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('active');
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const name = `${staffProfile?.first_name || 'Responder'} ${staffProfile?.last_name || ''}`.trim();
  const unit = staffProfile?.response_unit;
  const ambulance = staffProfile?.ambulance_number;

  const load = useCallback(async () => {
    try {
      let query = supabase
        .from('emergency_alerts')
        .select(
          `
          id,
          patient_id,
          responder_id,
          location,
          timestamp,
          emergency_status,
          priority,
          description,
          notes,
          resolved_at,
          created_at,
          updated_at,
          patients (
            first_name,
            last_name,
            contact_number,
            email
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(50);

      if (tab === 'active') {
        query = query.in('emergency_status', ['pending', 'dispatched']);
      } else {
        query = query.in('emergency_status', ['resolved', 'cancelled']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAlerts((data as AlertRow[]) || []);
    } catch (e) {
      console.error('First responder alerts error:', e);
      Alert.alert('Error', 'Could not load emergency alerts. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const updateAlert = async (
    alert: AlertRow,
    next: EmergencyStatus,
    extraNotes?: string
  ) => {
    setBusyId(alert.id);
    try {
      const payload: Record<string, unknown> = {
        emergency_status: next,
        updated_at: new Date().toISOString(),
      };

      if (next === 'dispatched' && staffProfile?.id) {
        payload.responder_id = staffProfile.id;
      }
      if (next === 'resolved') {
        payload.resolved_at = new Date().toISOString();
        if (staffProfile?.id && !alert.responder_id) {
          payload.responder_id = staffProfile.id;
        }
      }
      if (extraNotes) {
        payload.notes = [alert.notes, extraNotes].filter(Boolean).join('\n');
      }

      const { error } = await supabase
        .from('emergency_alerts')
        .update(payload)
        .eq('id', alert.id);

      if (error) throw error;
      await load();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Update failed', e.message || 'Could not update alert status');
    } finally {
      setBusyId(null);
    }
  };

  const confirmUpdate = (alert: AlertRow, next: EmergencyStatus) => {
    const labels: Record<EmergencyStatus, string> = {
      pending: 'pending',
      dispatched: 'dispatched (I am responding)',
      resolved: 'resolved',
      cancelled: 'cancelled',
    };
    Alert.alert('Update emergency', `Mark this alert as ${labels[next]}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: next === 'cancelled' ? 'destructive' : 'default',
        onPress: () => updateAlert(alert, next),
      },
    ]);
  };

  const patientName = (a: AlertRow) => {
    if (!a.patients) return 'Unknown patient';
    return `${a.patients.first_name || ''} ${a.patients.last_name || ''}`.trim() || 'Unknown patient';
  };

  const activeCount = alerts.filter((a) =>
    a.emergency_status === 'pending' || a.emergency_status === 'dispatched'
  ).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={['#B08968', '#FFFFFF', '#FFFFFF']}
        locations={[0, 0.14, 0.4]}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={['#6B7C5C']}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>First responder</Text>
              <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                {name}
              </Text>
              {(unit || ambulance) && (
                <Text style={styles.subMeta}>
                  {[unit, ambulance].filter(Boolean).join(' · ')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => navigation.navigate('FirstResponderProfile')}
              accessibilityLabel="Open profile"
            >
              <Text style={styles.avatarText}>
                {(staffProfile?.first_name?.[0] || 'R') + (staffProfile?.last_name?.[0] || '')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="warning" size={20} color="#E53935" />
              <Text style={styles.statNum}>
                {tab === 'active' ? alerts.length : activeCount}
              </Text>
              <Text style={styles.statLabel}>Active queue</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="time-outline" size={20} color="#FF9800" />
              <Text style={styles.statNum}>
                {alerts.filter((a) => a.emergency_status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'active' && styles.tabActive]}
              onPress={() => setTab('active')}
            >
              <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
                Active
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'history' && styles.tabActive]}
              onPress={() => setTab('history')}
            >
              <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#6B7C5C" />
              <Text style={styles.loadingText}>Loading alerts...</Text>
            </View>
          ) : alerts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name={tab === 'active' ? 'checkmark-circle-outline' : 'file-tray-outline'}
                size={48}
                color={tab === 'active' ? '#4CAF50' : '#BDBDBD'}
              />
              <Text style={styles.emptyTitle}>
                {tab === 'active' ? 'No active emergencies' : 'No history yet'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'active'
                  ? 'New patient alerts will appear here in real time after refresh.'
                  : 'Resolved and cancelled alerts will show here.'}
              </Text>
            </View>
          ) : (
            alerts.map((a) => {
              const status = a.emergency_status || 'pending';
              const statusColor = STATUS_COLOR[status] || '#999';
              const priority = (a.priority || 'high') as Priority;
              const pColor = PRIORITY_COLOR[priority] || '#E53935';
              const loc = formatLocation(a.location);
              const map = mapsUrl(a.location);
              const phone = a.patients?.contact_number;
              const busy = busyId === a.id;

              return (
                <View
                  key={a.id}
                  style={[styles.card, { backgroundColor: theme.colors.surface }]}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.patient}>{patientName(a)}</Text>
                      <Text style={styles.ref}>
                        Ref {a.id.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.badges}>
                      <View style={[styles.badge, { backgroundColor: pColor + '22' }]}>
                        <Text style={[styles.badgeText, { color: pColor }]}>
                          {priority}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>
                          {status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color="#888" />
                    <Text style={styles.meta} numberOfLines={2}>
                      {loc}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={14} color="#888" />
                    <Text style={styles.meta}>
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString('en-ZA')
                        : a.timestamp
                          ? new Date(a.timestamp).toLocaleString('en-ZA')
                          : '—'}
                    </Text>
                  </View>
                  {a.description ? (
                    <Text style={styles.desc}>{a.description}</Text>
                  ) : null}
                  {a.notes ? (
                    <Text style={styles.notes}>Notes: {a.notes}</Text>
                  ) : null}

                  {/* Quick links */}
                  <View style={styles.linkRow}>
                    {phone ? (
                      <TouchableOpacity
                        style={styles.linkBtn}
                        onPress={() => Linking.openURL(`tel:${phone}`)}
                      >
                        <Ionicons name="call" size={16} color="#6B7C5C" />
                        <Text style={styles.linkText}>Call</Text>
                      </TouchableOpacity>
                    ) : null}
                    {map ? (
                      <TouchableOpacity
                        style={styles.linkBtn}
                        onPress={() => Linking.openURL(map)}
                      >
                        <Ionicons name="map" size={16} color="#4A90D9" />
                        <Text style={[styles.linkText, { color: '#4A90D9' }]}>Map</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Status actions */}
                  {(status === 'pending' || status === 'dispatched') && (
                    <View style={styles.actions}>
                      {status === 'pending' && (
                        <TouchableOpacity
                          style={[styles.btn, { backgroundColor: '#FF9800' }, busy && styles.btnDisabled]}
                          disabled={busy}
                          onPress={() => confirmUpdate(a, 'dispatched')}
                        >
                          {busy ? (
                            <ActivityIndicator color="#FFF" size="small" />
                          ) : (
                            <Text style={styles.btnText}>Dispatch me</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.btn, { backgroundColor: '#4CAF50' }, busy && styles.btnDisabled]}
                        disabled={busy}
                        onPress={() => confirmUpdate(a, 'resolved')}
                      >
                        <Text style={styles.btnText}>Resolve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, { backgroundColor: '#9E9E9E' }, busy && styles.btnDisabled]}
                        disabled={busy}
                        onPress={() => confirmUpdate(a, 'cancelled')}
                      >
                        <Text style={styles.btnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}

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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  kicker: { color: '#E53935', fontWeight: '700', fontSize: 12, letterSpacing: 0.3 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 2 },
  subMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    gap: 4,
  },
  statNum: { fontSize: 22, fontWeight: '700', color: '#333' },
  statLabel: { fontSize: 11, color: '#777' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { fontWeight: '600', color: '#888', fontSize: 14 },
  tabTextActive: { color: '#333' },
  center: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 10, color: '#666' },
  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#444' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#999', textAlign: 'center' },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  patient: { fontWeight: '700', fontSize: 16, color: '#222' },
  ref: { fontSize: 11, color: '#999', marginTop: 2 },
  badges: { gap: 6, alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontWeight: '700', fontSize: 11, textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  meta: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18 },
  desc: { marginTop: 10, fontSize: 14, color: '#333', lineHeight: 20 },
  notes: { marginTop: 6, fontSize: 12, color: '#777', fontStyle: 'italic' },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  linkText: { color: '#6B7C5C', fontWeight: '600', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  logout: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  logoutText: { color: '#E53935', fontWeight: '700' },
});
