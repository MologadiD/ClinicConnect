import { supabase } from './supabase/client';

/** Standard appointment slot length in minutes */
export const SLOT_DURATION_MINUTES = 30;

/** How many days ahead to keep template slots available */
export const SLOT_HORIZON_DAYS = 14;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

/** Local calendar YYYY-MM-DD */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Add days to a YYYY-MM-DD string */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes from midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}

/** End time = start + 30 minutes */
export function endTimeFromStart(startTime: string): string {
  return minutesToTime(timeToMinutes(startTime) + SLOT_DURATION_MINUTES);
}

/**
 * True if this slot's start is still in the future (for today's date).
 * Future dates always count as future.
 */
export function isSlotInFuture(date: string, startTime: string, now = new Date()): boolean {
  const today = toDateString(now);
  if (date > today) return true;
  if (date < today) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(startTime) > nowMins;
}

export interface SlotRow {
  id: string;
  clinic_id?: string | null;
  service_id?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  max_patients?: number;
  booked_count?: number;
}

/**
 * After a slot is booked (or fills up), ensure the same time exists
 * as an available slot on the next calendar day.
 */
export async function ensureNextDaySlot(slotId: string): Promise<void> {
  const { data: slot, error } = await supabase
    .from('time_slots')
    .select('id, clinic_id, service_id, date, start_time, end_time, max_patients')
    .eq('id', slotId)
    .maybeSingle();

  if (error || !slot) {
    console.warn('ensureNextDaySlot: slot not found', error);
    return;
  }

  const nextDate = addDays(slot.date, 1);
  const start = slot.start_time?.slice(0, 5);
  const end = (slot.end_time?.slice(0, 5) || endTimeFromStart(start));

  const { data: existing } = await supabase
    .from('time_slots')
    .select('id')
    .eq('clinic_id', slot.clinic_id)
    .eq('service_id', slot.service_id)
    .eq('date', nextDate)
    .eq('start_time', start)
    .maybeSingle();

  if (existing) return;

  await supabase.from('time_slots').insert({
    clinic_id: slot.clinic_id,
    service_id: slot.service_id,
    date: nextDate,
    start_time: start,
    end_time: end,
    is_available: true,
    max_patients: slot.max_patients ?? 1,
    booked_count: 0,
  });
}

/**
 * For any past slots (date+time already gone), open the same wall-clock
 * time on the next day if it does not already exist.
 * Safe to call when loading the booking UI.
 */
export async function rollPastSlotsForward(
  clinicId: string,
  serviceId: string
): Promise<void> {
  const today = toDateString(new Date());
  const now = new Date();

  const { data: slots, error } = await supabase
    .from('time_slots')
    .select('id, clinic_id, service_id, date, start_time, end_time, max_patients, is_available, booked_count')
    .eq('clinic_id', clinicId)
    .eq('service_id', serviceId)
    .lte('date', today)
    .order('date', { ascending: false })
    .limit(80);

  if (error || !slots?.length) return;

  for (const slot of slots) {
    const past =
      slot.date < today ||
      (slot.date === today && !isSlotInFuture(slot.date, slot.start_time, now));

    if (!past) continue;

    // Always try to open tomorrow for this clock time
    const nextDate = addDays(today, 1);
    const start = slot.start_time?.slice(0, 5);
    const end = (slot.end_time?.slice(0, 5) || endTimeFromStart(start));

    const { data: existing } = await supabase
      .from('time_slots')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('service_id', serviceId)
      .eq('date', nextDate)
      .eq('start_time', start)
      .maybeSingle();

    if (!existing) {
      await supabase.from('time_slots').insert({
        clinic_id: clinicId,
        service_id: serviceId,
        date: nextDate,
        start_time: start,
        end_time: end,
        is_available: true,
        max_patients: slot.max_patients ?? 1,
        booked_count: 0,
      });
    }
  }
}

/**
 * Ensure a rolling window of available 30‑min slots exists for a clinic/service
 * based on the distinct start times already configured (template from any day).
 */
export async function ensureHorizonSlots(
  clinicId: string,
  serviceId: string,
  daysAhead = SLOT_HORIZON_DAYS
): Promise<void> {
  const { data: templates } = await supabase
    .from('time_slots')
    .select('start_time, end_time, max_patients')
    .eq('clinic_id', clinicId)
    .eq('service_id', serviceId)
    .limit(100);

  if (!templates?.length) return;

  const uniqueStarts = new Map<string, { end: string; max: number }>();
  for (const t of templates) {
    const start = t.start_time?.slice(0, 5);
    if (!start || uniqueStarts.has(start)) continue;
    uniqueStarts.set(start, {
      end: t.end_time?.slice(0, 5) || endTimeFromStart(start),
      max: t.max_patients ?? 1,
    });
  }

  const today = toDateString(new Date());
  for (let d = 0; d <= daysAhead; d++) {
    const date = addDays(today, d);
    for (const [start, meta] of uniqueStarts) {
      if (d === 0 && !isSlotInFuture(date, start)) continue;

      const { data: existing } = await supabase
        .from('time_slots')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('service_id', serviceId)
        .eq('date', date)
        .eq('start_time', start)
        .maybeSingle();

      if (existing) continue;

      await supabase.from('time_slots').insert({
        clinic_id: clinicId,
        service_id: serviceId,
        date,
        start_time: start,
        end_time: meta.end,
        is_available: true,
        max_patients: meta.max,
        booked_count: 0,
      });
    }
  }
}

/**
 * Bookable slots for UI: available, capacity left, and not in the past.
 */
export function filterBookableSlots(slots: SlotRow[], now = new Date()): SlotRow[] {
  return slots.filter((s) => {
    if (!s.is_available) return false;
    if ((s.booked_count ?? 0) >= (s.max_patients ?? 1)) return false;
    return isSlotInFuture(s.date, s.start_time, now);
  });
}

/**
 * Mark a time slot as booked for that day.
 * - Increments booked_count
 * - Sets is_available = false once capacity is reached (default max_patients = 1)
 * - Rolls the same wall-clock time forward to the next day so the schedule stays open
 */
export async function markSlotBooked(slotId: string): Promise<void> {
  const { data: slot, error } = await supabase
    .from('time_slots')
    .select('id, booked_count, max_patients, clinic_id, service_id, date, start_time, end_time')
    .eq('id', slotId)
    .maybeSingle();

  if (error || !slot) {
    console.warn('markSlotBooked: slot not found', error);
    return;
  }

  const max = slot.max_patients ?? 1;
  const newCount = (slot.booked_count ?? 0) + 1;
  // Once full (normal case max=1), the slot is unavailable for the rest of the day
  const available = newCount < max;

  const { error: updErr } = await supabase
    .from('time_slots')
    .update({
      booked_count: newCount,
      is_available: available,
      updated_at: new Date().toISOString(),
    })
    .eq('id', slotId);

  if (updErr) {
    console.warn('markSlotBooked: update failed', updErr);
    return;
  }

  // Keep the clinic's daily schedule rolling: open the same time tomorrow
  if (!available) {
    await ensureNextDaySlot(slotId);
  }
}
