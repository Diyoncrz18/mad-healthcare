-- Auto-create row in `public.doctors` when a user signs up with role='doctor'.
-- Mirrors the existing `handle_new_user()` trigger that populates patient_profiles
-- for role='user'. Tanpa trigger ini, dokter yang self-register via DoctorLoginScreen
-- akan punya entry di auth.users tapi TIDAK akan muncul di tabel `doctors`,
-- sehingga semua RLS policy `doctors.user_id = auth.uid()` gagal.

begin;

-- ═══════════════════════════════════════════════════════════════════
-- 1. INSERT TRIGGER — buat doctors row saat user baru dengan role='doctor'
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.handle_new_doctor()
returns trigger
language plpgsql
security definer
as $$
declare
  doctor_name      text;
  doctor_specialty text;
begin
  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'doctor' then
    doctor_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    );

    doctor_specialty := coalesce(
      nullif(trim(new.raw_user_meta_data->>'specialty'), ''),
      'Dokter Umum'
    );

    -- Skip kalau sudah ada doctors row dengan user_id ini
    if not exists (
      select 1 from public.doctors where user_id = new.id
    ) then
      insert into public.doctors (user_id, name, specialty, is_active)
      values (new.id, doctor_name, doctor_specialty, true);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_doctor on auth.users;
create trigger on_auth_user_created_doctor
  after insert on auth.users
  for each row execute procedure public.handle_new_doctor();


-- ═══════════════════════════════════════════════════════════════════
-- 2. UPDATE TRIGGER — sync nama & spesialisasi saat user_metadata berubah
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.handle_doctor_metadata_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(new.raw_user_meta_data->>'role', 'user') = 'doctor' then
    update public.doctors
    set
      name = coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'name'), ''),
        name
      ),
      specialty = coalesce(
        nullif(trim(new.raw_user_meta_data->>'specialty'), ''),
        specialty
      )
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_doctor on auth.users;
create trigger on_auth_user_updated_doctor
  after update on auth.users
  for each row execute procedure public.handle_doctor_metadata_update();


-- ═══════════════════════════════════════════════════════════════════
-- 3. BACKFILL — buat doctors row untuk dokter yang sudah daftar sebelumnya
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  u record;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users
    where coalesce(raw_user_meta_data->>'role', 'user') = 'doctor'
  loop
    if not exists (select 1 from public.doctors where user_id = u.id) then
      insert into public.doctors (user_id, name, specialty, is_active)
      values (
        u.id,
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
          nullif(trim(u.raw_user_meta_data->>'name'), ''),
          split_part(u.email, '@', 1)
        ),
        coalesce(
          nullif(trim(u.raw_user_meta_data->>'specialty'), ''),
          'Dokter Umum'
        ),
        true
      );
    end if;
  end loop;
end $$;

commit;
