'use strict';

const { supabaseAdmin } = require('./supabase');

/**
 * Daftar peer yang berhak menerima presence update untuk `userId`.
 * Peer = lawan bicara di setiap percakapan yang melibatkan user ini.
 *  - kalau user role 'user' (pasien), peer = doctors.user_id pada
 *    setiap conversation pasien tsb.
 *  - kalau user role 'doctor', peer = patient_id pada setiap
 *    conversation dokter tsb (perlu lookup row doctors dulu).
 *
 * Mengembalikan array string user-id tanpa duplikat.
 */
async function getPresencePeers(userId, role) {
  if (role === 'doctor') {
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from('doctors')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (docErr || !docRow) return [];
    const { data: rows, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('patient_id')
      .eq('doctor_id', docRow.id);
    if (error || !rows) return [];
    return Array.from(new Set(rows.map((r) => r.patient_id).filter(Boolean)));
  }

  // role 'user' → ambil dokter dari conversation, lalu user_id-nya
  const { data: rows, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('doctor:doctors!inner(user_id)')
    .eq('patient_id', userId);
  if (error || !rows) return [];
  return Array.from(
    new Set(
      rows
        .map((r) => r.doctor?.user_id)
        .filter((v) => typeof v === 'string' && v.length > 0)
    )
  );
}

/**
 * Validasi: apakah `socket.data.user` adalah peserta dari `conversationId`?
 * - patient_id == user.id (untuk role user), ATAU
 * - doctors.user_id == user.id pada doctor_id (untuk role doctor).
 *
 * Kembalikan { conversation } jika valid, atau { error }.
 */
async function getConversationIfMember(socket, conversationId) {
  const { user, doctor } = socket.data;
  if (!conversationId) return { error: 'CONVERSATION_ID_REQUIRED' };

  // Join ke doctors agar kita ikut dapat user_id dokter
  // (`doctor_id` di tabel ini menunjuk ke `doctors.id`, bukan auth.users).
  const { data: conv, error } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, patient_id, doctor_id, doctor:doctors!inner(user_id)')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!conv) return { error: 'CONVERSATION_NOT_FOUND' };

  const doctorUserId = conv.doctor?.user_id || null;
  const normalised = {
    id: conv.id,
    patient_id: conv.patient_id,
    doctor_id: conv.doctor_id,
    doctor_user_id: doctorUserId,
  };

  if (user.role === 'user' && normalised.patient_id === user.id) {
    return { conversation: normalised };
  }
  if (user.role === 'doctor' && doctor && doctor.id === normalised.doctor_id) {
    return { conversation: normalised };
  }
  return { error: 'NOT_A_MEMBER' };
}

/**
 * Daftar room yang akan kita pakai (dipakai konsisten di seluruh server).
 */
const room = {
  conversation: (id) => `conv:${id}`,
  user: (id) => `user:${id}`,
};

/**
 * Catat semua handler ke socket yang baru connect.
 *
 * Event listened:
 *   conversation:join    { conversationId }
 *   conversation:leave   { conversationId }
 *   message:send         { conversationId, message, clientId? }
 *   message:read         { conversationId, lastMessageId? }
 *   typing:start         { conversationId }
 *   typing:stop          { conversationId }
 *   presence:query       { userIds: string[] }
 *
 * Event emitted ke room:
 *   message:new          payload = ChatMessage
 *   message:read         { conversationId, readerId, lastMessageId, readAt }
 *   typing               { conversationId, userId, typing: boolean }
 *   presence:update      { userId, online }
 */
async function broadcastPresence(io, userId, role, online) {
  try {
    const peers = await getPresencePeers(userId, role);
    if (peers.length === 0) return;
    const targets = peers.map((id) => room.user(id));
    io.to(targets).emit('presence:update', { userId, online });
  } catch {
    /* presence non-kritis */
  }
}

function registerChatHandlers(io, socket, presence, opts = {}) {
  const me = socket.data.user;

  // ── Auto-join room user (untuk pesan masuk dari mana saja) ──
  socket.join(room.user(me.id));

  // ── Broadcast presence:online HANYA jika ini koneksi pertama ──
  //    user (transisi offline→online) DAN HANYA ke kontak relevan.
  if (opts.firstConnection) {
    broadcastPresence(io, me.id, me.role, true);
  }

  // ── Join sebuah conversation ────────────────────────────────
  socket.on('conversation:join', async (payload, cb) => {
    try {
      const { conversation, error } = await getConversationIfMember(
        socket,
        payload?.conversationId
      );
      if (error) {
        cb && cb({ ok: false, error });
        return;
      }
      socket.join(room.conversation(conversation.id));
      cb && cb({ ok: true, conversationId: conversation.id });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });

  socket.on('conversation:leave', (payload, cb) => {
    if (payload?.conversationId) {
      socket.leave(room.conversation(payload.conversationId));
    }
    cb && cb({ ok: true });
  });

  // ── Kirim pesan baru ─────────────────────────────────────────
  socket.on('message:send', async (payload, cb) => {
    try {
      const { conversationId, message, clientId } = payload || {};
      const text = String(message || '').trim();
      if (!text) return cb && cb({ ok: false, error: 'EMPTY_MESSAGE' });
      if (text.length > 4000) {
        return cb && cb({ ok: false, error: 'MESSAGE_TOO_LONG' });
      }

      const membership = await getConversationIfMember(socket, conversationId);
      if (membership.error) {
        return cb && cb({ ok: false, error: membership.error });
      }

      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .insert([
          {
            conversation_id: conversationId,
            sender_id: me.id,
            message: text,
          },
        ])
        .select('*')
        .single();

      if (error) {
        return cb && cb({ ok: false, error: error.message });
      }

      // ── Broadcast ke room conversation + ke kedua user-rooms ──
      const r = room.conversation(conversationId);
      io.to(r).emit('message:new', { ...data, clientId: clientId || null });

      const conv = membership.conversation;
      // Selain peserta yang sedang membuka percakapan, kirim juga ke
      // user-rooms supaya ChatList bisa update unread tanpa subscribe room.
      const targets = [room.user(conv.patient_id)];
      if (conv.doctor_user_id) targets.push(room.user(conv.doctor_user_id));
      io.to(targets).emit('conversation:bump', {
        conversationId,
        lastMessage: data.message,
        lastMessageAt: data.created_at,
        senderId: data.sender_id,
      });

      cb && cb({ ok: true, message: data });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });

  // ── Tandai pesan terbaca ─────────────────────────────────────
  socket.on('message:read', async (payload, cb) => {
    try {
      const { conversationId, lastMessageId } = payload || {};
      const membership = await getConversationIfMember(socket, conversationId);
      if (membership.error) {
        return cb && cb({ ok: false, error: membership.error });
      }

      // Update semua pesan dari pihak lawan yang belum kebaca.
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('chat_messages')
        .update({ read_at: now })
        .eq('conversation_id', conversationId)
        .neq('sender_id', me.id)
        .is('read_at', null);

      if (error) return cb && cb({ ok: false, error: error.message });

      const r = room.conversation(conversationId);
      io.to(r).emit('message:read', {
        conversationId,
        readerId: me.id,
        lastMessageId: lastMessageId || null,
        readAt: now,
      });
      cb && cb({ ok: true, readAt: now });
    } catch (err) {
      cb && cb({ ok: false, error: err.message });
    }
  });

  // ── Typing indicator ────────────────────────────────────────
  const handleTyping = async (payload, typing) => {
    try {
      const { conversationId } = payload || {};
      const membership = await getConversationIfMember(socket, conversationId);
      if (membership.error) return;
      socket.to(room.conversation(conversationId)).emit('typing', {
        conversationId,
        userId: me.id,
        typing,
      });
    } catch {
      /* swallow — typing tidak kritis */
    }
  };
  socket.on('typing:start', (p) => handleTyping(p, true));
  socket.on('typing:stop', (p) => handleTyping(p, false));

  // ── Query presence on demand ────────────────────────────────
  socket.on('presence:query', (payload, cb) => {
    const ids = Array.isArray(payload?.userIds) ? payload.userIds : [];
    const result = ids.reduce((acc, id) => {
      acc[id] = presence.isOnline(id);
      return acc;
    }, {});
    cb && cb({ ok: true, presence: result });
  });
}

module.exports = {
  registerChatHandlers,
  getConversationIfMember,
  broadcastPresence,
  room,
};
