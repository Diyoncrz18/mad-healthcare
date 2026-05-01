'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { attachAuth } = require('./lib/auth');
const presence = require('./lib/presence');
const {
  registerChatHandlers,
  broadcastPresence,
} = require('./lib/chatHandlers');
const geminiRouter = require('./lib/geminiRouter');
const conversationRouter = require('./lib/conversationRouter');
const appointmentCallRouter = require('./lib/appointmentCallRouter');

const PORT = Number(process.env.PORT || 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ── Express (untuk health-check & future REST) ──────────────────
const app = express();
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',') }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'careconnect-chat-server',
    ok: true,
    online: presence.onlineUserIds().length,
    uptime: process.uptime(),
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// ── REST helper untuk membuat percakapan chat dengan service-role ──
app.use('/', conversationRouter);

// ── REST helper untuk dokter memanggil pasien ke ruangan ─────────
app.use('/', appointmentCallRouter);

// ── Gemini AI proxy untuk HealthcareBot (POST /chat) ─────────────
app.use('/', geminiRouter);

// ── Socket.IO ────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','), credentials: true },
  path: '/socket.io',
  pingInterval: 25000,
  pingTimeout: 20000,
});
app.set('io', io);

io.use(attachAuth);

io.on('connection', (socket) => {
  const me = socket.data.user;
  const firstConnection = presence.add(me.id, socket.id);

  // eslint-disable-next-line no-console
  console.log(
    `[socket] connected userId=${me.id} role=${me.role} socket=${socket.id} first=${firstConnection}`
  );

  registerChatHandlers(io, socket, presence, { firstConnection });

  socket.on('disconnect', (reason) => {
    const offline = presence.remove(me.id, socket.id);
    if (offline) {
      // Broadcast hanya ke kontak relevan, bukan io.emit ke semua user.
      broadcastPresence(io, me.id, me.role, false).catch(() => undefined);
    }
    // eslint-disable-next-line no-console
    console.log(`[socket] disconnected userId=${me.id} socket=${socket.id} reason=${reason}`);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ careconnect-chat-server listening on http://0.0.0.0:${PORT}`);
});
