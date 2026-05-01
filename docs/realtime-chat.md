# Realtime Chat — Arsitektur & Operasional

Dokumen rancangan untuk fitur **Chat Dokter ↔ Pasien** memakai Socket.IO.
Lihat README server di `server/README.md` untuk detail event & endpoint.

---

## Komponen

```
┌────────────────────────┐                ┌─────────────────────────┐
│  React Native (Expo)   │  WebSocket+JWT │  Socket.IO Gateway      │
│  socketService.ts      │ ◀────────────▶ │  Node + Express + JWT   │
│                        │                │  (./server/src/index.js)│
│  ChatListScreen        │                │                         │
│  ChatDetailScreen      │                │     service-role        │
└──────────┬─────────────┘                └────────────┬────────────┘
           │                                            │
           │  REST (initial load + fallback)            │  Persist + RLS-bypass
           │                                            │
           └──────────────────┐               ┌─────────┘
                              ▼               ▼
                       ┌────────────────────────────┐
                       │       Supabase             │
                       │  Postgres + Auth + RLS     │
                       │  Realtime (cadangan)       │
                       └────────────────────────────┘
```

### Tabel
- `chat_conversations(id, patient_id, doctor_id, …)`
- `chat_messages(id, conversation_id, sender_id, message, created_at, read_at)`
- `chat_conversation_summaries` *(view — last message + unread counter)*

### Migration
1. `2026-04-29_add_doctor_patient_chat.sql` — skema awal + RLS.
2. `2026-04-29_chat_read_receipts.sql` — kolom `read_at` + view ringkasan.

---

## Alur Pengiriman Pesan

1. User mengetik di `ChatComposer` → `socketService.sendMessageRT(...)`.
2. Client menambahkan **optimistic message** ke list dengan `id = "tmp-xxx"`.
3. Server memvalidasi keanggotaan → `INSERT` via service-role → emit
   `message:new` ke room `conv:<id>` *dan* `conversation:bump` ke
   `user:<patientId>` & `user:<doctorUserId>`.
4. Client mengganti placeholder berdasarkan `clientId` yang dibawa balik.
5. Bila socket gagal, client otomatis fallback ke `chatService.sendMessage`
   (REST → Supabase Realtime tetap mendorong update).

## Read Receipts

- Saat layar detail terbuka, semua pesan masuk yang `read_at IS NULL`
  ditandai via `socketService.markMessagesRead(conversationId)`.
- Server update `read_at`, lalu emit `message:read` ke seluruh room.
- Pengirim melihat ikon check ganda berwarna terang.

## Typing Indicator

- `ChatComposer` memanggil `onTyping(true)` dengan debounce 1.2s.
- Client `socketService.startTyping/stopTyping` mem-broadcast ke room.
- Lawan menampilkan `<TypingDots>` di akhir list.

## Presence

- Server menyimpan registry `Map<userId, Set<socketId>>`.
- Saat connect/disconnect, `presence:update` di-broadcast ke seluruh user.
- Client `ChatListScreen` membungkus dengan polling awal `presence:query`
  untuk meng-prefetch status seluruh kontak.

---

## Konsistensi UI

Semua tampilan chat memakai design system (`Screens/constants/theme.ts`)
dan komponen dari `Screens/components/ui/chat.tsx`:

| Komponen        | Dipakai di            | Fungsi                                 |
|-----------------|-----------------------|----------------------------------------|
| `Avatar`        | List + Header         | Monogram + indikator online            |
| `UnreadBadge`   | List                  | Pil hitungan pesan belum dibaca        |
| `DateDivider`   | Detail                | "Hari ini", "Kemarin", tanggal         |
| `MessageBubble` | Detail                | Bubble + ekor + read receipt           |
| `TypingDots`    | Detail                | Animasi 3 titik                        |
| `ChatHeader`    | Detail                | Header kompak ala messenger            |
| `ChatComposer`  | Detail                | Input + tombol kirim                   |

Warna mengikuti **Medical Teal `#0891B2`** untuk pasien, **Deep Teal
`#0E7490`** untuk dokter; teks pakai skala slate; surface utama putih
dengan rounded `RADIUS.xl`. Hierarki visual mengikuti aturan: nama bold
saat ada unread, jam berwarna primary saat ada unread, separator hairline
slate-light.

---

## Cara Menjalankan (Dev)

```bash
# 1) Server
cd server
cp .env.example .env       # isi SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                # http://localhost:4000

# 2) Migration Supabase
# Eksekusi migration baru di SQL editor Supabase:
#   supabase/migrations/2026-04-29_chat_read_receipts.sql

# 3) Client (Expo)
cd ..
cp .env.example .env       # set EXPO_PUBLIC_SOCKET_URL ke IP server
npm install
npm run start
```

> ⚠️ Untuk akses dari HP fisik, pakai IP LAN PC (`http://192.168.x.x:4000`),
> bukan `localhost`.

---

## Pertimbangan Produksi

- **TLS**: terminasi di reverse proxy (Caddy/Nginx). Update `EXPO_PUBLIC_SOCKET_URL`
  ke `https://chat.example.com`.
- **Multi-instance**: pasang `@socket.io/redis-adapter` agar broadcast
  konsisten lintas node. Stub sudah disiapkan di `server/README.md`.
- **Audit & Logging**: server saat ini hanya `console.log` koneksi.
  Tambahkan pino/winston bila perlu telemetry.
- **Anti-abuse**: sudah ada batas 4000 char per pesan. Tambah rate-limit
  (mis. `socket.io-rate-limiter`) bila perlu.
- **Push Notification**: di luar scope dokumen ini. Hook event
  `message:new` di server untuk publish ke FCM/APNs.
