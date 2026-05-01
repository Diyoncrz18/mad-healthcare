-- ─────────────────────────────────────────────────────────────────
-- Privacy hardening: pasien & dokter hanya dapat membuat
-- chat_conversation jika sudah ada appointment (status valid) di antara
-- mereka. Ini menutup celah dimana attacker bisa memanggil REST API
-- Supabase langsung untuk membuat percakapan ke dokter random,
-- meski UI sudah memfilter.
--
-- Status appointment yang dianggap valid sengaja dibuat sama dengan
-- konstanta klien (`Screens/services/chatService.ts:VALID_APPOINTMENT_STATUSES`).
--
-- Idempotent: aman dijalankan ulang.
-- ─────────────────────────────────────────────────────────────────

begin;

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

-- ── Pasien membuat conversation ──────────────────────────────────
drop policy if exists "patients_create_own_chat_conversations" on public.chat_conversations;
create policy "patients_create_own_chat_conversations"
on public.chat_conversations
for insert
with check (
  patient_id = auth.uid()
  and public.is_patient_user(patient_id)
  and exists (
    select 1
    from public.doctors d
    where d.id = chat_conversations.doctor_id
      and d.user_id is not null
  )
  and public.has_active_appointment(patient_id, doctor_id)
);

-- ── Dokter membuat conversation ──────────────────────────────────
drop policy if exists "doctors_create_own_chat_conversations" on public.chat_conversations;
create policy "doctors_create_own_chat_conversations"
on public.chat_conversations
for insert
with check (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'doctor'
  and exists (
    select 1
    from public.doctors d
    where d.id = chat_conversations.doctor_id
      and d.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.patient_profiles p
    where p.user_id = chat_conversations.patient_id
  )
  and public.has_active_appointment(patient_id, doctor_id)
);

commit;
