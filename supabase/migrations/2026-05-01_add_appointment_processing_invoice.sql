begin;

alter table public.appointments
  add column if not exists consultation_note text,
  add column if not exists consultation_fee numeric(12,2),
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('pending', 'Confirmed', 'Diproses', 'Cancelled', 'Selesai'));

alter table public.appointments
  drop constraint if exists appointments_consultation_fee_check;

alter table public.appointments
  add constraint appointments_consultation_fee_check
  check (consultation_fee is null or consultation_fee >= 0);

create or replace function public.has_active_appointment(
  p_patient_id uuid,
  p_doctor_id  uuid
) returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.appointments a
    where a.user_id = p_patient_id
      and a.doctor_id = p_doctor_id
      and a.status in ('pending', 'Confirmed', 'Diproses', 'Selesai')
  );
$$;

commit;
