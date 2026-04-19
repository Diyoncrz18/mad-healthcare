-- Harden clinic schema for doctor account linkage, appointment integrity, and RLS.

begin;

create extension if not exists pg_trgm;

alter table public.doctors
  add column if not exists user_id uuid;

create unique index if not exists doctors_user_id_unique
  on public.doctors(user_id)
  where user_id is not null;

alter table public.appointments
  add column if not exists appointment_date date,
  add column if not exists appointment_time text;

update public.appointments
set
  appointment_date = split_part(date, ' | ', 1)::date,
  appointment_time = split_part(date, ' | ', 2)
where (appointment_date is null or appointment_time is null)
  and position(' | ' in date) > 0;

alter table public.appointments
  alter column status set default 'pending';

alter table public.appointments
  alter column appointment_date set not null,
  alter column appointment_time set not null;

create index if not exists appointments_user_id_idx
  on public.appointments(user_id);

create index if not exists appointments_doctor_id_created_at_idx
  on public.appointments(doctor_id, created_at desc);

create index if not exists appointments_doctor_schedule_idx
  on public.appointments(doctor_id, appointment_date, appointment_time);

create unique index if not exists appointments_active_doctor_slot_unique
  on public.appointments(doctor_id, appointment_date, appointment_time)
  where status <> 'Cancelled';

create or replace function public.normalize_doctor_name(input_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(trim(coalesce(input_name, ''))),
        '^(drg|dr|dokter)\.?\s+',
        '',
        'g'
      ),
      ',.*$',
      '',
      'g'
    ),
    '[^a-z0-9]',
    '',
    'g'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'admin';
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_status_check'
  ) then
    alter table public.appointments
      add constraint appointments_status_check
      check (status in ('pending', 'Confirmed', 'Cancelled', 'Selesai'));
  end if;
end $$;

alter table public.doctors enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "admins_manage_doctors" on public.doctors;
create policy "admins_manage_doctors"
on public.doctors
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "doctors_read_own_profile" on public.doctors;
create policy "doctors_read_own_profile"
on public.doctors
for select
using (user_id = auth.uid());

drop policy if exists "doctors_update_own_profile" on public.doctors;
create policy "doctors_update_own_profile"
on public.doctors
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "patients_read_own_appointments" on public.appointments;
create policy "patients_read_own_appointments"
on public.appointments
for select
using (user_id = auth.uid());

drop policy if exists "patients_create_own_appointments" on public.appointments;
create policy "patients_create_own_appointments"
on public.appointments
for insert
with check (
  user_id = auth.uid()
  and status = 'pending'
);

drop policy if exists "patients_update_own_pending_appointments" on public.appointments;
create policy "patients_update_own_pending_appointments"
on public.appointments
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "admins_manage_appointments" on public.appointments;
create policy "admins_manage_appointments"
on public.appointments
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "doctors_read_own_appointments" on public.appointments;
create policy "doctors_read_own_appointments"
on public.appointments
for select
using (
  exists (
    select 1
    from public.doctors d
    where d.user_id = auth.uid()
      and d.id = appointments.doctor_id
  )
);

drop policy if exists "doctors_update_own_appointments" on public.appointments;
create policy "doctors_update_own_appointments"
on public.appointments
for update
using (
  exists (
    select 1
    from public.doctors d
    where d.user_id = auth.uid()
      and d.id = appointments.doctor_id
  )
)
with check (
  exists (
    select 1
    from public.doctors d
    where d.user_id = auth.uid()
      and d.id = appointments.doctor_id
  )
);

commit;