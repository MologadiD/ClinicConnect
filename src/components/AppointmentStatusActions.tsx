import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  allowedNextStatuses,
  changeAppointmentStatus,
  SlotInfo,
  StatusActor,
} from '../services/appointmentStatus';
import { confirmAction, notify } from '../utils/dialogs';
import type { AppointmentStatus } from '../types';

interface Props {
  appointmentId: string;
  status: string;
  slot?: SlotInfo | null;
  /** Called after any attempt so the parent can reload its list. */
  onChanged: () => void;
  /** Doctors only: shown while the appointment is confirmed. */
  onPrescribe?: () => void;
}

const ACTION_META: Partial<
  Record<AppointmentStatus, { label: string; color: string; outlined?: boolean; confirm?: string }>
> = {
  confirmed: { label: 'Confirm', color: '#2E7D32' },
  completed: {
    label: 'Complete visit',
    color: '#7B1FA2',
    confirm: 'Mark this visit as completed? This cannot be undone.',
  },
  no_show: {
    label: 'No-show',
    color: '#E65100',
    outlined: true,
    confirm: 'Mark this patient as a no-show? This cannot be undone.',
  },
  cancelled: {
    label: 'Cancel',
    color: '#C62828',
    outlined: true,
    confirm: 'Cancel this appointment? The time slot will be released.',
  },
};

/** Role-aware buttons for moving an appointment through its lifecycle. */
export default function AppointmentStatusActions({
  appointmentId,
  status,
  slot,
  onChanged,
  onPrescribe,
}: Props) {
  const { role } = useAuth();
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);

  const actor: StatusActor | null =
    role === 'Doctor' || role === 'Nurse' || role === 'Admin' || role === 'patient' ? role : null;

  const next = useMemo(
    () => (actor ? allowedNextStatuses(status as AppointmentStatus, actor, slot) : []),
    [actor, status, slot]
  );

  const showPrescribe = !!onPrescribe && role === 'Doctor' && status === 'confirmed';

  if (!actor || (next.length === 0 && !showPrescribe)) return null;

  const run = async (target: AppointmentStatus) => {
    const meta = ACTION_META[target];
    if (!meta) return;
    if (meta.confirm && !(await confirmAction(meta.label, meta.confirm))) return;

    try {
      setBusy(target);
      await changeAppointmentStatus({ appointmentId, next: target, actor, slot });
    } catch (e: any) {
      notify('Could not update appointment', e?.message || 'Please try again.');
    } finally {
      setBusy(null);
      onChanged(); // always reload so the list reflects what is really in the database
    }
  };

  return (
    <View style={styles.row}>
      {showPrescribe && (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#6B7C5C', borderColor: '#6B7C5C' }]}
          onPress={onPrescribe}
          disabled={busy !== null}
        >
          <Text style={[styles.btnText, { color: '#FFF' }]}>Prescribe</Text>
        </TouchableOpacity>
      )}
      {next.map((target) => {
        const meta = ACTION_META[target];
        if (!meta) return null;
        const isBusy = busy === target;
        return (
          <TouchableOpacity
            key={target}
            style={[
              styles.btn,
              { borderColor: meta.color, backgroundColor: meta.outlined ? 'transparent' : meta.color },
              busy !== null && !isBusy && styles.dim,
            ]}
            onPress={() => run(target)}
            disabled={busy !== null}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={meta.outlined ? meta.color : '#FFF'} />
            ) : (
              <Text style={[styles.btnText, { color: meta.outlined ? meta.color : '#FFF' }]}>
                {meta.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  btn: {
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '600' },
  dim: { opacity: 0.4 },
});
