import { supabase } from './supabase/client';
import { isSlotInFuture } from './slots';
import type { AppointmentStatus } from '../types';

/**
 * Appointment status rules.
 *
 *   booked ──► confirmed ──► completed
 *     │            │
 *     ├──► cancelled (from booked or confirmed)
 *     └──► no_show   (from booked or confirmed, only after the slot start time)
 *
 * completed / cancelled / no_show are final: nothing can move out of them.
 *
 * NOTE: these rules are enforced in the app only. The database accepts any
 * of the five values from the owning patient or any clinician (see the RLS
 * policy `appointments_update`), so they are NOT a security boundary.
 */
export type StatusActor = 'patient' | 'Doctor' | 'Nurse' | 'Admin';

const TRANSITIONS: Record<
  AppointmentStatus,
  Partial<Record<AppointmentStatus, StatusActor[]>>
> = {
  booked: {
    confirmed: ['Nurse', 'Doctor'],
    cancelled: ['patient', 'Nurse', 'Doctor', 'Admin'],
    no_show: ['Nurse', 'Doctor'],
  },
  confirmed: {
    completed: ['Doctor'],
    cancelled: ['patient', 'Nurse', 'Doctor', 'Admin'],
    no_show: ['Nurse', 'Doctor'],
  },
  completed: {},
  cancelled: {},
  no_show: {},
};

export interface SlotInfo {
  date?: string | null;
  start_time?: string | null;
}

export class StatusChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatusChangeError';
  }
}

/** A no-show can only be recorded once the appointment's start time has passed. */
function slotHasStarted(slot?: SlotInfo | null): boolean {
  if (!slot?.date || !slot.start_time) return false; // cannot verify -> not allowed
  return !isSlotInFuture(slot.date, slot.start_time);
}

/** Statuses `actor` may move an appointment to from `current`. */
export function allowedNextStatuses(
  current: AppointmentStatus,
  actor: StatusActor,
  slot?: SlotInfo | null
): AppointmentStatus[] {
  const rules = TRANSITIONS[current] ?? {};
  return (Object.keys(rules) as AppointmentStatus[]).filter((next) => {
    if (!rules[next]?.includes(actor)) return false;
    if (next === 'no_show' && !slotHasStarted(slot)) return false;
    return true;
  });
}

/**
 * Release one place on a slot after a cancellation.
 * Uses a compare-and-set on booked_count so two cancellations at the same
 * moment cannot both read the same count and under-release.
 */
async function releaseSlot(slotId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: slot, error } = await supabase
      .from('time_slots')
      .select('booked_count')
      .eq('id', slotId)
      .maybeSingle();
    if (error || !slot) return;

    let q = supabase
      .from('time_slots')
      .update({
        booked_count: Math.max(0, (slot.booked_count ?? 1) - 1),
        is_available: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', slotId);
    q = slot.booked_count == null ? q.is('booked_count', null) : q.eq('booked_count', slot.booked_count);

    const { data: updated, error: updErr } = await q.select('id');
    if (updErr) {
      console.warn('releaseSlot failed:', updErr);
      return;
    }
    if (updated && updated.length > 0) return; // success; otherwise someone else changed it, retry
  }
}

/**
 * Move an appointment to `next`.
 * The update only succeeds if the appointment is STILL in a status the actor
 * is allowed to move from, so a stale screen or two people clicking at once
 * cannot push an appointment through an illegal transition.
 */
export async function changeAppointmentStatus(params: {
  appointmentId: string;
  next: AppointmentStatus;
  actor: StatusActor;
  slot?: SlotInfo | null;
}): Promise<void> {
  const { appointmentId, next, actor, slot } = params;

  const allowedFrom = (Object.keys(TRANSITIONS) as AppointmentStatus[]).filter((from) =>
    allowedNextStatuses(from, actor, slot).includes(next)
  );
  if (allowedFrom.length === 0) {
    throw new StatusChangeError(`You cannot change an appointment to "${next}" right now.`);
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .in('status', allowedFrom)
    .select('id, time_slot_id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new StatusChangeError(
      'This appointment was already updated by someone else, or you do not have permission to change it.'
    );
  }

  if (next === 'cancelled' && data[0].time_slot_id) {
    await releaseSlot(data[0].time_slot_id);
  }
}
