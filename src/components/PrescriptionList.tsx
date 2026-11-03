import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  effectiveStatus,
  isUsable,
  Prescription,
  prescriptionsApi,
} from '../services/api/prescriptions';
import { confirmAction, notify } from '../utils/dialogs';
import { shareOrDownloadPdf } from '../utils/shareText';

interface Props {
  /** Show prescriptions issued for one appointment... */
  appointmentId?: string;
  /** ...or every prescription for a patient. */
  patientId?: string;
  patientName?: string;
  /** Doctors may withdraw an active prescription. */
  canCancel?: boolean;
  /** Render nothing at all when there are none (patient appointment page). */
  hideWhenEmpty?: boolean;
  title?: string;
}

const CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: 'Active', bg: '#E8F5E9', fg: '#2E7D32' },
  expired: { label: 'Expired', bg: '#FFF3E0', fg: '#E65100' },
  cancelled: { label: 'Cancelled', bg: '#FFEBEE', fg: '#C62828' },
  completed: { label: 'Completed', bg: '#F3E5F5', fg: '#7B1FA2' },
};

const fmt = (d?: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-ZA') : '—';

/** Read-only prescription cards. Download is offered only while a prescription is still valid. */
export default function PrescriptionList({
  appointmentId,
  patientId,
  patientName,
  canCancel,
  hideWhenEmpty,
  title,
}: Props) {
  const { role, profile } = useAuth();
  const [items, setItems] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const name =
    patientName || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined);

  const load = useCallback(async () => {
    try {
      setError(null);
      const rows = appointmentId
        ? await prescriptionsApi.getByAppointment(appointmentId)
        : patientId
          ? await prescriptionsApi.getByPatient(patientId)
          : [];
      setItems(rows);
    } catch (e: any) {
      console.error('Failed to load prescriptions:', e);
      setError('Could not load prescriptions.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, patientId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const download = async (rx: Prescription) => {
    try {
      setBusyId(rx.id);
      await shareOrDownloadPdf(
        `prescription-${rx.id.slice(0, 8)}.pdf`,
        prescriptionsApi.formatAsHtml(rx, name)
      );
    } catch (e: any) {
      notify('Could not download', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (rx: Prescription) => {
    const ok = await confirmAction(
      'Cancel prescription',
      'The patient will no longer be able to use it. To correct it you must issue a new one.',
      'Yes, cancel'
    );
    if (!ok) return;
    try {
      setBusyId(rx.id);
      await prescriptionsApi.cancel(rx.id, role);
    } catch (e: any) {
      notify('Could not cancel', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
      load();
    }
  };

  if (loading) return <ActivityIndicator color="#6B7C5C" style={{ marginVertical: 12 }} />;
  if (!error && items.length === 0) {
    return hideWhenEmpty ? null : <Text style={styles.empty}>No prescriptions</Text>;
  }

  return (
    <View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items.map((rx) => {
        const status = effectiveStatus(rx);
        const chip = CHIP[status] || CHIP.active;
        const usable = isUsable(rx);
        const doctor = rx.doctor
          ? `Dr ${rx.doctor.first_name || ''} ${rx.doctor.last_name || ''}`.trim()
          : null;
        return (
          <View key={rx.id} style={[styles.card, !usable && styles.cardMuted]}>
            <View style={styles.headRow}>
              <Text style={styles.head}>Prescription</Text>
              <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              Issued {fmt(rx.issued_at)}
              {doctor ? ` by ${doctor}` : ''} · Valid until {fmt(rx.valid_until)}
            </Text>
            {rx.diagnosis ? <Text style={styles.line}>Diagnosis: {rx.diagnosis}</Text> : null}
            {(rx.medications || []).map((m, i) => (
              <View key={i} style={styles.med}>
                <Text style={styles.medName}>{m.name}</Text>
                <Text style={styles.medDetail}>
                  {m.dosage} · {m.frequency} · {m.duration}
                </Text>
                {m.instructions ? <Text style={styles.medDetail}>{m.instructions}</Text> : null}
              </View>
            ))}
            {rx.notes ? <Text style={styles.line}>Notes: {rx.notes}</Text> : null}

            {usable ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => download(rx)}
                  disabled={busyId === rx.id}
                >
                  {busyId === rx.id ? (
                    <ActivityIndicator size="small" color="#6B7C5C" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#6B7C5C" />
                      <Text style={styles.actionText}>Download PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
                {canCancel ? (
                  <TouchableOpacity
                    style={styles.action}
                    onPress={() => cancel(rx)}
                    disabled={busyId === rx.id}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#C62828" />
                    <Text style={[styles.actionText, { color: '#C62828' }]}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <Text style={styles.invalid}>This prescription can no longer be used.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 8 },
  empty: { color: '#888', marginBottom: 12 },
  error: { color: '#C62828', marginBottom: 8 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardMuted: { opacity: 0.7 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  head: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  chipText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: '#777', marginTop: 4, marginBottom: 8 },
  line: { fontSize: 13, color: '#444', marginBottom: 6 },
  med: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  medName: { fontSize: 14, fontWeight: '600', color: '#222' },
  medDetail: { fontSize: 12, color: '#666', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#6B7C5C' },
  invalid: { marginTop: 8, fontSize: 12, color: '#C62828' },
});