-- ════════════════════════════════════════════════════════════════════
-- Cleanup Script — Hapus Semua Data di public.doctors
-- ════════════════════════════════════════════════════════════════════
-- Tujuan : membersihkan tabel `public.doctors` (start fresh).
-- Cara   : copy-paste seluruh script ini ke
--          Supabase Dashboard → SQL Editor → New query → Run.
--
-- Cascade behavior:
--   • doctor_schedules    → ON DELETE CASCADE      (auto-terhapus)
--   • appointments        → set doctor_id = NULL   (riwayat dipreservasi)
--   • notifications       → tidak terdampak
--   • auth.users          → tidak disentuh (akun login lama tetap ada)
--
-- Catatan:
--   • Script DIBUNGKUS transaksi (BEGIN..COMMIT). Jika ada error,
--     seluruh perubahan otomatis di-rollback — aman dijalankan.
--   • Setelah dijalankan, admin bisa membuat ulang dokter dari halaman
--     Admin → Manajemen Dokter, atau via Supabase Auth (akun dengan
--     role='doctor' akan otomatis dapat baris di tabel `doctors`
--     berkat trigger handle_new_doctor()).
-- ════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Snapshot sebelum cleanup ───────────────────────────────────
select 'doctors (sebelum)'           as tabel, count(*) as jumlah from public.doctors
union all
select 'doctor_schedules (sebelum)',          count(*)           from public.doctor_schedules
union all
select 'appointments dgn doctor_id (sebelum)', count(*)          from public.appointments where doctor_id is not null;

-- ─── 2. Lepaskan referensi dokter dari appointments lama ──────────
--      (preserve baris appointment, hilangkan link ke dokter)
update public.appointments
set    doctor_id = null
where  doctor_id is not null;

-- ─── 3. Hapus semua dokter (cascade → doctor_schedules) ───────────
delete from public.doctors;

-- ─── 4. Snapshot setelah cleanup ──────────────────────────────────
select 'doctors (setelah)'           as tabel, count(*) as jumlah from public.doctors
union all
select 'doctor_schedules (setelah)',          count(*)           from public.doctor_schedules
union all
select 'appointments dgn doctor_id (setelah)', count(*)          from public.appointments where doctor_id is not null;

commit;
