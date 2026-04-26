-- Add patient_profiles, doctor_schedules, notifications + auto-trigger.
-- Covers: real notifications, persisted schedules, admin-readable patient emails.

begin;

-- ═══════════════════════════════════════════════════════════════════
-- 1. PATIENT PROFILES — mirror auth.users untuk akses client-side
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.patient_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  phone        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists patient_profiles_email_idx
  on public.patient_profiles(email);

-- Trigger: populate on signup (only for role='user' or null)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'user' then
    insert into public.patient_profiles (user_id, email, display_name, phone)
    values (
      new.id,
      new.email,
      coalesce(
        new.raw_user_meta_data->>'display_name',
        split_part(new.email, '@', 1)
      ),
      new.raw_user_meta_data->>'phone'
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: sync display_name & phone saat user_metadata diupdate
create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'user' then
    update public.patient_profiles
    set
      display_name = coalesce(
        new.raw_user_meta_data->>'display_name',
        display_name
      ),
      phone = coalesce(new.raw_user_meta_data->>'phone', phone),
      email = new.email,
      updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_user_metadata_update();

-- Backfill existing patient users
insert into public.patient_profiles (user_id, email, display_name, phone)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'phone'
from auth.users
where coalesce(raw_user_meta_data->>'role', 'user') = 'user'
on conflict (user_id) do nothing;

-- RLS
alter table public.patient_profiles enable row level security;

drop policy if exists "users_read_own_profile" on public.patient_profiles;
create policy "users_read_own_profile"
on public.patient_profiles for select
using (user_id = auth.uid());

drop policy if exists "users_update_own_profile" on public.patient_profiles;
create policy "users_update_own_profile"
on public.patient_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "admins_read_all_profiles" on public.patient_profiles;
create policy "admins_read_all_profiles"
on public.patient_profiles for select
using (public.is_admin());

drop policy if exists "admins_manage_profiles" on public.patient_profiles;
create policy "admins_manage_profiles"
on public.patient_profiles for all
using (public.is_admin())
with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════
-- 2. DOCTOR SCHEDULES — jadwal mingguan dokter
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.doctor_schedules (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id) on delete cascade,
  day_of_week   int  not null check (day_of_week between 0 and 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  is_active     boolean default true,
  start_time    text not null default '08:00',
  end_time      text not null default '17:00',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(doctor_id, day_of_week)
);

create index if not exists doctor_schedules_doctor_idx
  on public.doctor_schedules(doctor_id);

-- RLS
alter table public.doctor_schedules enable row level security;

drop policy if exists "anyone_read_schedules" on public.doctor_schedules;
create policy "anyone_read_schedules"
on public.doctor_schedules for select
using (true);

drop policy if exists "doctors_manage_own_schedule" on public.doctor_schedules;
create policy "doctors_manage_own_schedule"
on public.doctor_schedules for all
using (
  exists (
    select 1 from public.doctors d
    where d.id = doctor_schedules.doctor_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.doctors d
    where d.id = doctor_schedules.doctor_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists "admins_manage_all_schedules" on public.doctor_schedules;
create policy "admins_manage_all_schedules"
on public.doctor_schedules for all
using (public.is_admin())
with check (public.is_admin());

-- Seed default schedules for existing doctors (Mon-Fri active, weekend off)
insert into public.doctor_schedules (doctor_id, day_of_week, is_active, start_time, end_time)
select
  d.id,
  dow,
  case
    when dow in (0, 6) then false   -- Sunday & Saturday off by default
    else true
  end,
  '08:00',
  case when dow = 5 then '15:00' else '17:00' end -- Friday shorter
from public.doctors d
cross join generate_series(0, 6) as dow
on conflict (doctor_id, day_of_week) do nothing;


-- ═══════════════════════════════════════════════════════════════════
-- 3. NOTIFICATIONS — recipient-based notifikasi sistem
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id                     uuid primary key default gen_random_uuid(),
  recipient_id           uuid not null references auth.users(id) on delete cascade,
  type                   text not null check (type in ('appointment', 'system', 'success')),
  title                  text not null,
  message                text not null,
  is_read                boolean default false,
  related_appointment_id uuid references public.appointments(id) on delete set null,
  created_at             timestamptz default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id)
  where is_read = false;

-- RLS — hanya recipient & admin
alter table public.notifications enable row level security;

drop policy if exists "users_read_own_notifications" on public.notifications;
create policy "users_read_own_notifications"
on public.notifications for select
using (recipient_id = auth.uid());

drop policy if exists "users_update_own_notifications" on public.notifications;
create policy "users_update_own_notifications"
on public.notifications for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

drop policy if exists "admins_manage_notifications" on public.notifications;
create policy "admins_manage_notifications"
on public.notifications for all
using (public.is_admin())
with check (public.is_admin());

-- (Sengaja tidak ada policy INSERT untuk client.
--  Notifikasi HANYA dibuat via trigger yang security-definer.)


-- ═══════════════════════════════════════════════════════════════════
-- 4. NOTIFICATION TRIGGER — auto-generate saat appointment events
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.handle_appointment_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  doc_user_id uuid;
  date_label  text;
  time_label  text;
begin
  -- Resolve doctor's auth.user_id
  select user_id into doc_user_id
  from public.doctors
  where id = new.doctor_id;

  -- Format date label
  date_label := coalesce(
    to_char(new.appointment_date, 'DD Mon YYYY'),
    new.date,
    '—'
  );
  time_label := coalesce(new.appointment_time, '—');

  -- INSERT: notify dokter ada permintaan baru
  if (TG_OP = 'INSERT') then
    if doc_user_id is not null then
      insert into public.notifications
        (recipient_id, type, title, message, related_appointment_id)
      values (
        doc_user_id,
        'appointment',
        'Permintaan Konsultasi Baru',
        'Pasien ' || new.patient_name || ' mengajukan konsultasi pada '
          || date_label || ' pukul ' || time_label || '.',
        new.id
      );
    end if;
    return new;
  end if;

  -- UPDATE: notify pasien jika status berubah
  if (TG_OP = 'UPDATE' and old.status is distinct from new.status) then
    if new.status = 'Confirmed' then
      insert into public.notifications
        (recipient_id, type, title, message, related_appointment_id)
      values (
        new.user_id,
        'success',
        'Reservasi Dikonfirmasi',
        'Janji konsultasi Anda dengan ' || new.doctor_name || ' pada '
          || date_label || ' pukul ' || time_label || ' telah dikonfirmasi.',
        new.id
      );
    elsif new.status = 'Cancelled' then
      insert into public.notifications
        (recipient_id, type, title, message, related_appointment_id)
      values (
        new.user_id,
        'system',
        'Reservasi Dibatalkan',
        'Janji konsultasi Anda dengan ' || new.doctor_name || ' pada '
          || date_label || ' telah dibatalkan.',
        new.id
      );
    elsif new.status = 'Selesai' then
      insert into public.notifications
        (recipient_id, type, title, message, related_appointment_id)
      values (
        new.user_id,
        'success',
        'Konsultasi Selesai',
        'Konsultasi Anda dengan ' || new.doctor_name || ' telah ditandai selesai. Terima kasih.',
        new.id
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists appointment_notification_trigger on public.appointments;
create trigger appointment_notification_trigger
  after insert or update on public.appointments
  for each row execute procedure public.handle_appointment_notification();


commit;
