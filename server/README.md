# CareConnect — Unified Server

Server tunggal yang melayani **dua kebutuhan**:

1. **Chat dokter ↔ pasien** (Socket.IO + Supabase) — realtime, presence,
   read receipts, typing.
2. **HealthcareBot AI proxy** (REST `/chat`) — meneruskan pesan ke Google
   Gemini tanpa membocorkan API key ke client.

Berdiri sendiri di luar aplikasi Expo agar mudah dideploy (Render, Railway,
Fly, VPS, dll).

## Stack

- Node.js ≥ 18, Express, Socket.IO 4
- Supabase JS SDK (anon untuk verifikasi JWT, service-role untuk persist)
- Google Generative Language API (Gemini)

## Setup

```bash
cd server
cp .env.example .env
# isi SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role)
npm install
npm run dev
```

Server berjalan di `http://localhost:4000`.

> Untuk akses dari **device fisik** (HP), pakai IP LAN PC, misalnya
> `http://192.168.1.7:4000`. Lalu set `EXPO_PUBLIC_SOCKET_URL=http://192.168.1.7:4000`
> di project Expo.

## Endpoint

| Method | Path         | Deskripsi                                           |
|-------:|--------------|-----------------------------------------------------|
| GET    | `/`          | health + online counter                             |
| GET    | `/healthz`   | minimal liveness probe                              |
| POST   | `/chat`      | Gemini AI proxy untuk HealthcareBot                 |
| WS     | `/socket.io` | Socket.IO entrypoint                                |

### `POST /chat`

Body:
```json
{
  "system": "(opsional) system prompt",
  "history": [
    { "role": "user",  "parts": [{ "text": "..." }] },
    { "role": "model", "parts": [{ "text": "..." }] }
  ],
  "message": "pesan terbaru dari user"
}
```

Response sukses: `{ "reply": "string" }`. Error code:
`GEMINI_NOT_CONFIGURED`, `EMPTY_MESSAGE`, `MESSAGE_TOO_LONG`,
`GEMINI_UPSTREAM_ERROR`, `GEMINI_EMPTY_RESPONSE`.

> ⚠️ **Mengapa di server, bukan di client?** API key Gemini tidak boleh
> ter-bundle ke aplikasi mobile (mudah diekstrak). Server juga bisa
> rate-limit & log pemakaian.

## Auth

Client mengirim `accessToken` Supabase pada handshake:

```ts
io(SOCKET_URL, { auth: { token: accessToken } });
```

Middleware `attachAuth` memverifikasi token via `supabase.auth.getUser`, lalu
menyimpan `socket.data.user` (`id`, `email`, `role`) dan `socket.data.doctor`
(jika role doctor).

## Events

### Client → Server

| Event                | Payload                                          |
|----------------------|--------------------------------------------------|
| `conversation:join`  | `{ conversationId }`                             |
| `conversation:leave` | `{ conversationId }`                             |
| `message:send`       | `{ conversationId, message, clientId? }`         |
| `message:read`       | `{ conversationId, lastMessageId? }`             |
| `typing:start`       | `{ conversationId }`                             |
| `typing:stop`        | `{ conversationId }`                             |
| `presence:query`     | `{ userIds: string[] }`                          |

Semua event mendukung `ack` callback `(response) => {}`. Server mengembalikan
`{ ok: boolean, ...data | error }`.

### Server → Client

| Event                | Payload                                                                 |
|----------------------|-------------------------------------------------------------------------|
| `message:new`        | `ChatMessage & { clientId? }`                                           |
| `message:read`       | `{ conversationId, readerId, lastMessageId, readAt }`                   |
| `typing`             | `{ conversationId, userId, typing }`                                    |
| `presence:update`    | `{ userId, online }`                                                    |
| `conversation:bump`  | `{ conversationId, lastMessage, lastMessageAt, senderId }`              |

## Keamanan

- Service-role key **HANYA** ada di server — tidak boleh di-bundle ke client.
- Setiap event yang menyentuh data chat melewati `getConversationIfMember`
  yang memverifikasi keanggotaan berdasarkan `auth.users.id` ↔ `patient_id`
  atau `doctors.user_id` ↔ `doctor_id`.
- Pesan dibatasi 4000 karakter dan tidak boleh kosong.

## Production

- Aktifkan TLS dari reverse proxy (Caddy/Nginx) atau platform PaaS.
- Set `CORS_ORIGIN` ke domain client.
- Untuk multi-instance, pakai Redis adapter:
  ```bash
  npm i @socket.io/redis-adapter ioredis
  ```
  lalu di `index.js` panggil `io.adapter(createAdapter(pubClient, subClient))`.
