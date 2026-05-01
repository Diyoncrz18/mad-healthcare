-- Add real-time doctor-patient chat.

begin;

create table if not exists public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_id  uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(patient_id, doctor_id)
);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  message         text not null check (length(trim(message)) > 0),
  created_at      timestamptz default now()
);

create index if not exists chat_conversations_patient_updated_idx
  on public.chat_conversations(patient_id, updated_at desc);

create index if not exists chat_conversations_doctor_updated_idx
  on public.chat_conversations(doctor_id, updated_at desc);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages(conversation_id, created_at asc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "patients_read_all_doctors_for_chat" on public.doctors;
create policy "patients_read_all_doctors_for_chat"
on public.doctors for select
using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'user');

drop policy if exists "doctors_read_patient_profiles_for_chat" on public.patient_profiles;
create policy "doctors_read_patient_profiles_for_chat"
on public.patient_profiles for select
using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'doctor');

create or replace function public.is_patient_user(user_uuid uuid)
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'user'
    and exists (
      select 1
      from public.patient_profiles p
      where p.user_id = user_uuid
    );
$$;

create or replace function public.is_chat_participant(conversation_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.chat_conversations c
    left join public.doctors d on d.id = c.doctor_id
    where c.id = conversation_uuid
      and exists (
        select 1
        from public.patient_profiles p
        where p.user_id = c.patient_id
      )
      and (
        (c.patient_id = auth.uid() and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'user')
        or (d.user_id = auth.uid() and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', 'user') = 'doctor')
      )
  );
$$;

drop policy if exists "patients_read_own_chat_conversations" on public.chat_conversations;
create policy "patients_read_own_chat_conversations"
on public.chat_conversations for select
using (patient_id = auth.uid());

drop policy if exists "doctors_read_own_chat_conversations" on public.chat_conversations;
create policy "doctors_read_own_chat_conversations"
on public.chat_conversations for select
using (
  exists (
    select 1
    from public.doctors d
    where d.id = chat_conversations.doctor_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists "patients_create_own_chat_conversations" on public.chat_conversations;
create policy "patients_create_own_chat_conversations"
on public.chat_conversations for insert
with check (
  patient_id = auth.uid()
  and public.is_patient_user(patient_id)
  and exists (
    select 1
    from public.doctors d
    where d.id = chat_conversations.doctor_id
      and d.user_id is not null
  )
);

drop policy if exists "doctors_create_own_chat_conversations" on public.chat_conversations;
create policy "doctors_create_own_chat_conversations"
on public.chat_conversations for insert
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
);

drop policy if exists "participants_read_chat_messages" on public.chat_messages;
create policy "participants_read_chat_messages"
on public.chat_messages for select
using (public.is_chat_participant(conversation_id));

drop policy if exists "participants_create_chat_messages" on public.chat_messages;
create policy "participants_create_chat_messages"
on public.chat_messages for insert
with check (
  sender_id = auth.uid()
  and public.is_chat_participant(conversation_id)
);

create or replace function public.touch_chat_conversation()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chat_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
  after insert on public.chat_messages
  for each row execute procedure public.touch_chat_conversation();

do $$
begin
  alter publication supabase_realtime add table public.chat_conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
