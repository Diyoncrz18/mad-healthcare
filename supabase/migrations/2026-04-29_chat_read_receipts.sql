-- Tambahkan dukungan read-receipts dan unread counter untuk chat realtime.
-- Idempotent: aman dijalankan ulang.

begin;

-- ── Kolom read_at di chat_messages ──────────────────────────────
alter table public.chat_messages
  add column if not exists read_at timestamptz;

create index if not exists chat_messages_unread_idx
  on public.chat_messages(conversation_id, sender_id)
  where read_at is null;

-- ── Izin UPDATE untuk peserta percakapan ────────────────────────
-- Postgres tidak punya RLS column-level, jadi kita lapisi dengan
-- trigger BEFORE UPDATE yang menolak perubahan kolom apa pun selain
-- `read_at`. Ini mencegah tampering konten pesan oleh peserta lain.
drop policy if exists "participants_mark_read_chat_messages" on public.chat_messages;
create policy "participants_mark_read_chat_messages"
on public.chat_messages
for update
using (
  public.is_chat_participant(conversation_id)
  and sender_id <> auth.uid()
)
with check (
  public.is_chat_participant(conversation_id)
  and sender_id <> auth.uid()
);

create or replace function public.protect_chat_message_columns()
returns trigger
language plpgsql
as $$
begin
  -- Hanya read_at yang boleh berubah lewat update non-service-role.
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at
  then
    raise exception 'CHAT_MESSAGE_IMMUTABLE_FIELDS'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_protect_columns on public.chat_messages;
create trigger chat_messages_protect_columns
  before update on public.chat_messages
  for each row execute procedure public.protect_chat_message_columns();

-- ── View: ringkasan tiap percakapan + unread untuk current user ─
-- WAJIB pakai `security_invoker = true` (Postgres ≥15) supaya RLS
-- underlying table tetap diterapkan saat view dibaca lewat anon /
-- authenticated. Tanpa flag ini, view berjalan sebagai owner dan
-- BYPASS RLS.
drop view if exists public.chat_conversation_summaries;
create view public.chat_conversation_summaries
with (security_invoker = true) as
with last_msg as (
  select distinct on (conversation_id)
    conversation_id,
    id as last_message_id,
    sender_id as last_sender_id,
    message as last_message,
    created_at as last_message_at,
    read_at as last_message_read_at
  from public.chat_messages
  order by conversation_id, created_at desc
)
select
  c.id,
  c.patient_id,
  c.doctor_id,
  c.created_at,
  c.updated_at,
  lm.last_message_id,
  lm.last_sender_id,
  lm.last_message,
  lm.last_message_at,
  lm.last_message_read_at,
  -- Unread untuk pasien (pesan dari dokter yang belum dibaca pasien)
  coalesce((
    select count(*)::int
    from public.chat_messages m
    join public.doctors d on d.id = c.doctor_id
    where m.conversation_id = c.id
      and m.sender_id = d.user_id
      and m.read_at is null
  ), 0) as unread_for_patient,
  -- Unread untuk dokter (pesan dari pasien yang belum dibaca dokter)
  coalesce((
    select count(*)::int
    from public.chat_messages m
    where m.conversation_id = c.id
      and m.sender_id = c.patient_id
      and m.read_at is null
  ), 0) as unread_for_doctor
from public.chat_conversations c
left join last_msg lm on lm.conversation_id = c.id;

grant select on public.chat_conversation_summaries to authenticated;

commit;
