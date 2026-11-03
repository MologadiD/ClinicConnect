-- Atomic, race-free appointment booking.
-- Apply in the Supabase SQL editor (or `supabase db push`).

-- 1. Every slot holds exactly ONE patient.
--    Normalise existing rows and default new ones.
update public.time_slots set max_patients = 1 where max_patients is distinct from 1;
alter table public.time_slots alter column max_patients set default 1;

--    Hard guarantee: at most one active appointment per slot.
--    (If this fails, two active appointments already share a slot; cancel or
--    move one, then re-run.)
create unique index if not exists appointments_one_active_per_slot_uniq
  on public.appointments (time_slot_id)
  where status in ('booked', 'confirmed');

-- 2. Booking function. Locks the slot row so concurrent bookings queue up.
create or replace function public.book_appointment(
  p_patient_id uuid,
  p_clinic_id uuid,
  p_service_id uuid,
  p_time_slot_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.time_slots%rowtype;
  v_active int;
  v_appt_id uuid;
begin
  -- Caller must own the patient record.
  if not exists (
    select 1 from public.patients
    where id = p_patient_id and user_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden',
      'message', 'You can only book for your own patient profile.');
  end if;

  -- Serialise this patient's bookings (guards the one-per-day rule).
  perform pg_advisory_xact_lock(hashtext(p_patient_id::text));

  -- Lock the slot row: concurrent callers wait here.
  select * into v_slot from public.time_slots
  where id = p_time_slot_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'slot_missing',
      'message', 'This time slot no longer exists.');
  end if;

  if v_slot.date < current_date then
    return jsonb_build_object('ok', false, 'code', 'slot_past',
      'message', 'This time slot is in the past.');
  end if;

  -- Count real active appointments instead of trusting booked_count.
  select count(*) into v_active from public.appointments
  where time_slot_id = p_time_slot_id and status in ('booked', 'confirmed');

  if not coalesce(v_slot.is_available, true)
     or v_active >= 1 then
    update public.time_slots
      set booked_count = v_active, is_available = false, updated_at = now()
      where id = p_time_slot_id;
    return jsonb_build_object('ok', false, 'code', 'slot_taken',
      'message', 'This time slot was just booked by someone else. Please choose another time.');
  end if;

  -- One active appointment per patient per day.
  if exists (
    select 1 from public.appointments a
    join public.time_slots t on t.id = a.time_slot_id
    where a.patient_id = p_patient_id
      and a.status in ('booked', 'confirmed')
      and t.date = v_slot.date
  ) then
    return jsonb_build_object('ok', false, 'code', 'one_per_day',
      'message', 'You already have an appointment on this day. Only one booking per day is allowed.');
  end if;

  insert into public.appointments
    (patient_id, clinic_id, service_id, time_slot_id, reason_for_visit, status)
  values
    (p_patient_id, p_clinic_id, p_service_id, p_time_slot_id,
     coalesce(nullif(trim(p_reason), ''), 'General consultation'), 'booked')
  returning id into v_appt_id;

  update public.time_slots
    set booked_count = v_active + 1,
        is_available = false,
        updated_at = now()
    where id = p_time_slot_id;

  return jsonb_build_object('ok', true, 'appointment_id', v_appt_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'slot_taken',
    'message', 'This time slot was just booked by someone else. Please choose another time.');
end;
$$;

revoke all on function public.book_appointment(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, uuid, text) to authenticated;

-- 3. Realtime: let clients subscribe to slot changes (greys slots out live).
do $$ begin
  alter publication supabase_realtime add table public.time_slots;
exception when duplicate_object then null;
end $$;
