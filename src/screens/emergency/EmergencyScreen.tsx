// src/screens/emergency/EmergencyScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase/client';
import { getUserLocation, CAPE_TOWN_COORDINATES } from '../../utils/location';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Emergency'>;

type Priority = 'low' | 'medium' | 'high' | 'critical';
type AlertStatus = 'pending' | 'dispatched' | 'resolved' | 'cancelled';

interface EmergencyAlertRow {
  id: string;
  emergency_status: AlertStatus;
  priority: Priority;
  description: string | null;
  location: { latitude?: number; longitude?: number; address?: string } | null;
  timestamp: string;
}

/**
 * EMERGENCY PERIOD
 * From the moment an alert is sent until a responder resolves it (or the patient
 * cancels it) the patient has an "active emergency". During that period:
 *   - they can't send another alert (no duplicates / accidental repeats)
 *   - this screen shows live status, a running timer and call buttons
 * An alert nobody resolves stops counting after this many hours, so a forgotten
 * alert can never lock a patient out of sending a new one.
 */
const EMERGENCY_PERIOD_HOURS = 2;
const POLL_INTERVAL_MS = 8000;

const ALERT_COLUMNS = 'id, emergency_status, priority, description, location, timestamp';

const PRIORITIES: { key: Priority; label: string; color: string; desc: string }[] = [
  { key: 'critical', label: 'Critical', color: '#E53935', desc: 'Life-threatening' },
  { key: 'high', label: 'High', color: '#FB8C00', desc: 'Urgent medical help' },
  { key: 'medium', label: 'Medium', color: '#FF9800', desc: 'Needs attention soon' },
  { key: 'low', label: 'Low', color: '#4CAF50', desc: 'Non-urgent assistance' },
];

const isActiveStatus = (s: AlertStatus) => s === 'pending' || s === 'dispatched';

function formatElapsed(fromIso: string, nowMs: number) {
  const secs = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function EmergencyScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { profile, user } = useAuth();

  // ---- form state ----
  const [priority, setPriority] = useState<Priority>('critical');
  const [description, setDescription] = useState('');
  const [locationLabel, setLocationLabel] = useState('Detecting location...');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ---- emergency period state ----
  const [checking, setChecking] = useState(true);
  const [alertRow, setAlertRow] = useState<EmergencyAlertRow | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const patientIdRef = useRef<string | null>(profile?.id ?? null);

  const resolvePatientId = useCallback(async (): Promise<string> => {
    if (patientIdRef.current) return patientIdRef.current;
    if (profile?.id) {
      patientIdRef.current = profile.id;
      return profile.id;
    }
    if (!user) throw new Error('You must be logged in to send an emergency alert.');
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (error || !data) {
      throw new Error('Patient profile not found. Please complete your profile first.');
    }
    patientIdRef.current = data.id;
    return data.id;
  }, [profile?.id, user]);

  /** The patient's current active alert inside the emergency period, if any. */
  const fetchActiveAlert = useCallback(async (): Promise<EmergencyAlertRow | null> => {
    const patientId = await resolvePatientId();
    const since = new Date(Date.now() - EMERGENCY_PERIOD_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('emergency_alerts')
      .select(ALERT_COLUMNS)
      .eq('patient_id', patientId)
      .in('emergency_status', ['pending', 'dispatched'])
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as EmergencyAlertRow | null) ?? null;
  }, [resolvePatientId]);

  // On open: is there already an emergency in progress?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const active = await fetchActiveAlert();
        if (!cancelled) setAlertRow(active);
      } catch (e) {
        console.error('Could not check for an active emergency:', e);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchActiveAlert]);

  useEffect(() => {
    loadLocation();
  }, []);

  // Tick every second while an alert is on screen (drives the timer)
  useEffect(() => {
    if (!alertRow) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [alertRow?.id]);

  // Poll for status changes (responder dispatched / resolved) while active
  useEffect(() => {
    if (!alertRow || !isActiveStatus(alertRow.emergency_status)) return;
    const id = alertRow.id;
    const poll = setInterval(async () => {
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select(ALERT_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        setAlertRow((prev) =>
          prev && prev.id === id && prev.emergency_status !== data.emergency_status
            ? (data as EmergencyAlertRow)
            : prev
        );
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [alertRow?.id, alertRow?.emergency_status]);

  const loadLocation = async () => {
    setLocating(true);
    try {
      const location = await getUserLocation();
      if (location) {
        setCoords(location);
        setLocationLabel(`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);
      } else {
        // Fallback so the alert can still be sent
        setCoords(CAPE_TOWN_COORDINATES);
        setLocationLabel('Location unavailable — using approximate area');
      }
    } catch {
      setCoords(CAPE_TOWN_COORDINATES);
      setLocationLabel('Location unavailable — using approximate area');
    } finally {
      setLocating(false);
    }
  };

  const handleSend = () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to send an emergency alert.');
      return;
    }
    if (!coords) {
      Alert.alert('Location required', 'Please wait for location or try again.');
      return;
    }

    Alert.alert(
      'Confirm Emergency Alert',
      'This will notify emergency responders. Only use this in a real emergency. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Alert', style: 'destructive', onPress: submitAlert },
      ]
    );
  };

  const submitAlert = async () => {
    if (submitting) return; // guards double taps
    setSubmitting(true);
    try {
      const patientId = await resolvePatientId();

      // Re-check on the server: covers a second device or a stale screen
      const existing = await fetchActiveAlert();
      if (existing) {
        setAlertRow(existing);
        setJustSent(false);
        Alert.alert(
          'Emergency already in progress',
          'You already have an active emergency alert. Responders have it.'
        );
        return;
      }

      const locationPayload = {
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        address: locationLabel.includes('unavailable') ? undefined : locationLabel,
      };

      // `timestamp` is left to the database default (now()) so the emergency
      // period is measured with the server's clock, not the phone's.
      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert({
          patient_id: patientId,
          location: locationPayload,
          emergency_status: 'pending',
          priority,
          description: description.trim() || null,
        })
        .select(ALERT_COLUMNS)
        .single();

      if (error) throw error;

      setAlertRow(data as EmergencyAlertRow);
      setJustSent(true);
      setDescription('');
    } catch (err: any) {
      console.error('Emergency alert error:', err);
      Alert.alert(
        'Could not send alert',
        err.message || 'Something went wrong. Please try again or call emergency services directly.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAlert = () => {
    if (!alertRow) return;
    const dispatched = alertRow.emergency_status === 'dispatched';
    Alert.alert(
      'Cancel emergency alert?',
      dispatched
        ? 'A responder has already been dispatched to you. Only cancel if you are safe and no longer need help.'
        : "Only cancel if you're safe and no longer need help.",
      [
        { text: 'Keep alert', style: 'cancel' },
        {
          text: 'Cancel alert',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const { data, error } = await supabase
                .from('emergency_alerts')
                .update({
                  emergency_status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', alertRow.id)
                .select(ALERT_COLUMNS)
                .maybeSingle();
              if (error) throw error;
              // RLS can silently block an update (0 rows, no error)
              if (!data) {
                throw new Error(
                  'The alert could not be cancelled. If you are safe, please tell the responder when they contact you.'
                );
              }
              setAlertRow(data as EmergencyAlertRow);
              setJustSent(false);
            } catch (err: any) {
              Alert.alert('Could not cancel', err.message || 'Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Could not open the dialer', `Please dial ${number} manually.`)
    );
  };

  // ------------------------------------------------------------------
  // Checking for an existing emergency
  // ------------------------------------------------------------------
  if (checking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#E53935" />
          <Text style={styles.checkingText}>Checking emergency status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------------
  // Emergency period: an alert is active, or has just ended
  // ------------------------------------------------------------------
  if (alertRow) {
    const status = alertRow.emergency_status;
    const active = isActiveStatus(status);
    const prio = PRIORITIES.find((p) => p.key === alertRow.priority);

    const view = {
      pending: {
        icon: 'time' as const,
        color: '#FB8C00',
        title: 'Alert received',
        text: 'Waiting for a responder to accept your alert. Stay where you are if it is safe.',
        pill: 'PENDING',
      },
      dispatched: {
        icon: 'medkit' as const,
        color: '#1E88E5',
        title: 'Help is on the way',
        text: 'A responder has been dispatched to your location. Stay calm and keep your phone close.',
        pill: 'RESPONDER DISPATCHED',
      },
      resolved: {
        icon: 'checkmark-circle' as const,
        color: '#4CAF50',
        title: 'Emergency resolved',
        text: 'Responders have marked this emergency as resolved. Take care.',
        pill: 'RESOLVED',
      },
      cancelled: {
        icon: 'close-circle' as const,
        color: '#757575',
        title: 'Alert cancelled',
        text: 'This alert was cancelled. You can send a new one at any time if you need help.',
        pill: 'CANCELLED',
      },
    }[status];

    const loc = alertRow.location;
    const locText = loc?.address
      ? loc.address
      : loc?.latitude != null && loc?.longitude != null
      ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
      : 'Location not available';

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.periodContent} showsVerticalScrollIndicator={false}>
          {justSent && active && (
            <View style={styles.sentBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.sentBannerText}>Emergency alert sent successfully</Text>
            </View>
          )}

          <View style={[styles.statusIcon, { backgroundColor: view.color }]}>
            <Ionicons name={view.icon} size={48} color="#FFF" />
          </View>
          <View style={[styles.statusPill, { backgroundColor: view.color + '22' }]}>
            <Text style={[styles.statusPillText, { color: view.color }]}>{view.pill}</Text>
          </View>
          <Text style={styles.successTitle}>{view.title}</Text>
          <Text style={styles.successMessage}>{view.text}</Text>

          {active && (
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>Time since alert</Text>
              <Text style={styles.timerValue}>{formatElapsed(alertRow.timestamp, nowMs)}</Text>
            </View>
          )}

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference</Text>
              <Text style={styles.detailValueMono}>{alertRow.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Priority</Text>
              <Text style={[styles.detailValue, prio && { color: prio.color }]}>
                {prio?.label ?? alertRow.priority}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {locText}
              </Text>
            </View>
            {alertRow.description ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Details</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={3}>
                  {alertRow.description}
                </Text>
              </View>
            ) : null}
          </View>

          {active ? (
            <>
              <Text style={styles.periodNote}>
                While your emergency is active you can't send another alert. This screen updates
                automatically.
              </Text>

              <View style={styles.callRow}>
                <TouchableOpacity style={styles.callBtn} onPress={() => callNumber('112')}>
                  <Ionicons name="call" size={18} color="#FFF" />
                  <Text style={styles.callBtnText}>Call 112</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.callBtn} onPress={() => callNumber('10177')}>
                  <Ionicons name="call" size={18} color="#FFF" />
                  <Text style={styles.callBtnText}>Ambulance 10177</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('PatientHome', {})}
              >
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelAlertBtn}
                onPress={handleCancelAlert}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#C62828" />
                ) : (
                  <Text style={styles.cancelAlertText}>I'm safe — cancel alert</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('PatientHome', {})}
              >
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  // Period is over: show the normal form again
                  setAlertRow(null);
                  setJustSent(false);
                }}
              >
                <Text style={styles.secondaryBtnText}>Send a new alert</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ------------------------------------------------------------------
  // No active emergency: the alert form
  // ------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Emergency</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Warning banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={28} color="#E53935" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Emergency assistance</Text>
              <Text style={styles.warningText}>
                Use this only in a real emergency. If you can, also call local emergency
                services (e.g. 112 or 10177).
              </Text>
            </View>
          </View>

          {/* Location */}
          <Text style={styles.sectionLabel}>Your location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={22} color="#E53935" />
              <View style={{ flex: 1 }}>
                {locating ? (
                  <View style={styles.locatingRow}>
                    <ActivityIndicator size="small" color="#E53935" />
                    <Text style={styles.locationText}>Detecting location...</Text>
                  </View>
                ) : (
                  <Text style={styles.locationText}>{locationLabel}</Text>
                )}
              </View>
              <TouchableOpacity onPress={loadLocation} disabled={locating} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={20} color="#6B7C5C" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Priority */}
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.priorityGrid}>
            {PRIORITIES.map((p) => {
              const selected = priority === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.priorityChip,
                    selected && { borderColor: p.color, backgroundColor: p.color + '18' },
                  ]}
                  onPress={() => setPriority(p.key)}
                >
                  <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                  <Text style={[styles.priorityLabel, selected && { color: p.color }]}>
                    {p.label}
                  </Text>
                  <Text style={styles.priorityDesc}>{p.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={styles.sectionLabel}>What happened? (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Briefly describe the emergency..."
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          {/* Send */}
          <TouchableOpacity
            style={[styles.sendBtn, (submitting || locating) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={submitting || locating}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="warning" size={22} color="#FFF" />
                <Text style={styles.sendBtnText}>Send Emergency Alert</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By sending, you confirm this is a genuine emergency and that responders may
            contact you and share your location with emergency services.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  checkingText: { marginTop: 12, fontSize: 14, color: '#666' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#B71C1C',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  locationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  refreshBtn: {
    padding: 6,
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  priorityChip: {
    width: '47%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  priorityDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    minHeight: 100,
    marginBottom: 24,
  },
  sendBtn: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnDisabled: {
    opacity: 0.65,
  },
  sendBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  disclaimer: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },

  // Emergency period view
  periodContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  sentBannerText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  statusIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  timerCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
  },
  timerLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerValue: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 16,
    gap: 10,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 13, color: '#888' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  detailValueMono: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  periodNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  callRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  callBtn: {
    flex: 1,
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  primaryBtn: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  cancelAlertBtn: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EF9A9A',
    backgroundColor: '#FFF',
  },
  cancelAlertText: { fontSize: 15, fontWeight: '600', color: '#C62828' },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7C5C',
  },
});