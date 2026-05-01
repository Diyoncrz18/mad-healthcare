-- Allow patients to start chat with any active doctor account.
-- Previously chat creation required an active appointment, which made the
-- "Konsultasi" button fail even when the doctor was marked active.

begin;

create or replace function public.is_active_chat_doctor(p_doctor_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.doctors d
    where d.id = p_doctor_id
      and d.user_id is not null
      and d.is_active = true
  );
$$;

drop policy if exists "patients_create_own_chat_conversations" on public.chat_conversations;
create policy "patients_create_own_chat_conversations"
on public.chat_conversations
for insert
with check (
  patient_id = auth.uid()
  and public.is_patient_user(patient_id)
  and public.is_active_chat_doctor(doctor_id)
);

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
      and d.is_active = true
  )
  and exists (
    select 1
    from public.patient_profiles p
    where p.user_id = chat_conversations.patient_id
  )
);

commit;
