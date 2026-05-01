/**
 * socketService — singleton Socket.IO client untuk fitur chat realtime.
 *
 * Tanggung jawab:
 *  - membentuk koneksi tunggal yang reusable lintas screen,
 *  - menyuntik access-token Supabase saat handshake,
 *  - reconnect otomatis dengan backoff,
 *  - menyediakan API tipis & strongly-typed untuk join/leave/send/typing/read.
 *
 * Server target diset via env:
 *   EXPO_PUBLIC_SOCKET_URL=http://192.168.1.7:4000
 *
 * Pemakaian:
 *   await getSocket();               // memastikan terkoneksi
 *   const off = onMessageNew(...);   // subscribe
 *   off();                           // unsubscribe
 */
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { supabase } from '../../supabase';
import { ChatMessage } from '../types';
import { resolveBackendUrl } from './backendUrl';

// ─────────────────────────────────────────────────────────────────
// Tipe payload server → client
// ─────────────────────────────────────────────────────────────────
export type MessageNewPayload = ChatMessage & { clientId?: string | null };

export type MessageReadPayload = {
  conversationId: string;
  readerId: string;
  lastMessageId: string | null;
  readAt: string;
};

export type TypingPayload = {
  conversationId: string;
  userId: string;
  typing: boolean;
};

export type PresenceUpdatePayload = {
  userId: string;
  online: boolean;
};

export type ConversationBumpPayload = {
  conversationId: string;
  lastMessage: string;
  lastMessageAt: string;
  senderId: string;
};

export type PatientCalledPayload = {
  appointmentId: string;
  notificationId?: string | null;
  patientId: string;
  patientName: string;
  doctorName: string;
  title: string;
  message: string;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────────
// Module-level singleton
// ─────────────────────────────────────────────────────────────────
/**
 * URL server backend. Default per platform:
 *   - Android (emulator): http://10.0.2.2:4000
 *   - iOS Simulator/Web : http://localhost:4000
 * Untuk **device fisik** WAJIB override via env:
 *   EXPO_PUBLIC_SOCKET_URL=http://<IP-LAN-PC>:4000
 */
const DEFAULT_SOCKET_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

const SOCKET_URL =
  resolveBackendUrl(process.env.EXPO_PUBLIC_SOCKET_URL as string | undefined, DEFAULT_SOCKET_URL);

let socket: Socket | null = null;
let connectingPromise: Promise<Socket> | null = null;
/** Flag in-flight refreshSession untuk mencegah call paralel berulang
 *  saat reconnection engine memuntahkan banyak `connect_error` beruntun. */
let refreshingToken = false;

/** Total timeout untuk satu panggilan getSocket(). Cegah hang selamanya
 *  bila server backend tidak jalan atau token tidak bisa di-refresh.
 *  8 detik cukup untuk koneksi lambat, cepat untuk fail bila server mati. */
const GET_SOCKET_TIMEOUT_MS = 8_000;

const getAccessToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

/**
 * Pastikan socket terkoneksi (lazy). Aman dipanggil berkali-kali —
 * akan memakai instance yang sudah ada.
 *
 * Reject dengan `SOCKET_AUTH_TIMEOUT` jika auth-error berulang sampai
 * GET_SOCKET_TIMEOUT_MS (≈ session expired & refresh juga gagal).
 * Caller bisa menangkap ini lalu redirect user ke login.
 */
export const getSocket = async (): Promise<Socket> => {
  if (socket && socket.connected) return socket;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('Tidak ada session aktif. Silakan login ulang.');

    if (!socket) {
      socket = io(SOCKET_URL, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 5000,
        timeout: 12000,
        autoConnect: false,
      });

      // Saat server me-reject karena token kadaluarsa, refresh sekali,
      // suntik token baru ke socket.auth, biarkan reconnection engine
      // bawaan retry. Guard `refreshingToken` mencegah beberapa panggilan
      // refreshSession paralel ketika `connect_error` muncul beruntun.
      socket.on('connect_error', async (err: Error) => {
        if (!socket) return;
        const isAuthError = String(err.message || '')
          .toLowerCase()
          .includes('unauthorized');
        if (!isAuthError) return;
        if (refreshingToken) return;
        refreshingToken = true;
        try {
          await supabase.auth.refreshSession();
          const fresh = await getAccessToken();
          if (fresh && socket) {
            socket.auth = { token: fresh };
          }
        } catch {
          /* biar aplikasi yang menampilkan error */
        } finally {
          refreshingToken = false;
        }
      });
    } else {
      socket.auth = { token };
    }

    if (!socket.connected) {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        // Outer timeout: hentikan kalau auth-error berulang & refresh token
        // tidak menyelesaikan handshake dalam batas waktu yang masuk akal.
        const timeoutTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('SOCKET_AUTH_TIMEOUT'));
        }, GET_SOCKET_TIMEOUT_MS);

        const cleanup = () => {
          clearTimeout(timeoutTimer);
          socket?.off('connect', onOk);
          socket?.off('connect_error', onErr);
        };
        const onOk = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };
        // Hanya REJECT pada error NON-auth. Auth error ditangani listener
        // `connect_error` di atas (refresh + retry oleh engine reconnection
        // bawaan). Kalau berulang sampai outer timeout, baru reject.
        const onErr = (err: Error) => {
          if (settled) return;
          const isAuthError = String(err.message || '')
            .toLowerCase()
            .includes('unauthorized');
          if (isAuthError) return; // biarkan retry
          settled = true;
          cleanup();
          reject(err);
        };
        socket?.on('connect', onOk);
        socket?.on('connect_error', onErr);
        socket?.connect();
      });
    }

    return socket!;
  })();

  try {
    return await connectingPromise;
  } finally {
    connectingPromise = null;
  }
};

/**
 * Tutup koneksi (mis. pada logout). Aman dipanggil berkali-kali.
 * Reset flag `socketUnavailable` agar login berikutnya boleh mencoba lagi.
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  socketUnavailable = false;
};

// ─────────────────────────────────────────────────────────────────
// Helpers — emit
// ─────────────────────────────────────────────────────────────────
type Ack<T> = { ok: boolean; error?: string } & T;

/**
 * Cache flag: setelah `getSocket()` gagal sekali (mis. server backend
 * tidak jalan), emitWithAck akan langsung return `{ok:false}` tanpa
 * menunggu 20 detik per panggilan. Direset saat `disconnectSocket()`.
 *
 * UI tetap fungsional tanpa socket (chat list & messages dibaca langsung
 * dari Supabase). Presence/typing/realtime saja yang non-aktif.
 */
let socketUnavailable = false;

// ❗ Pakai function declaration (bukan arrow function) untuk hindari
//    ambiguitas Babel parser dengan JSX pada generic `<T = ...>`.
async function emitWithAck<T = Record<string, unknown>>(
  event: string,
  payload: unknown,
  timeoutMs = 8000
): Promise<Ack<T>> {
  if (socketUnavailable) {
    return { ok: false, error: 'SOCKET_UNAVAILABLE' } as Ack<T>;
  }
  // ❗ JANGAN bungkus `await getSocket()` di dalam Promise constructor
  // dengan async callback — exception dari async tidak ter-propagate
  // ke Promise tersebut, menyebabkan hang permanen.
  let sock: Socket;
  try {
    sock = await getSocket();
  } catch (err: any) {
    socketUnavailable = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[socket] tidak tersedia; fitur realtime non-aktif:',
      err?.message || err
    );
    return { ok: false, error: err?.message || 'SOCKET_UNAVAILABLE' } as Ack<T>;
  }
  return new Promise<Ack<T>>((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: 'TIMEOUT' } as Ack<T>),
      timeoutMs
    );
    sock.emit(event, payload, (resp: Ack<T>) => {
      clearTimeout(timer);
      resolve(resp || ({ ok: false, error: 'NO_RESPONSE' } as Ack<T>));
    });
  });
}

export const joinConversation = (conversationId: string) =>
  emitWithAck<{ conversationId?: string }>('conversation:join', { conversationId });

export const leaveConversation = (conversationId: string) =>
  emitWithAck('conversation:leave', { conversationId });

export const sendMessageRT = (
  conversationId: string,
  message: string,
  clientId?: string
) =>
  emitWithAck<{ message?: ChatMessage }>('message:send', {
    conversationId,
    message,
    clientId,
  });

export const markMessagesRead = (conversationId: string, lastMessageId?: string) =>
  emitWithAck<{ readAt?: string }>('message:read', { conversationId, lastMessageId });

export const startTyping = async (conversationId: string) => {
  if (socketUnavailable) return;
  try {
    const sock = await getSocket();
    sock.emit('typing:start', { conversationId });
  } catch {
    socketUnavailable = true;
  }
};

export const stopTyping = async (conversationId: string) => {
  if (socketUnavailable) return;
  try {
    const sock = await getSocket();
    sock.emit('typing:stop', { conversationId });
  } catch {
    socketUnavailable = true;
  }
};

export const queryPresence = (userIds: string[]) =>
  emitWithAck<{ presence?: Record<string, boolean> }>('presence:query', { userIds });

// ─────────────────────────────────────────────────────────────────
// Helpers — subscribe (return unsubscriber)
// ─────────────────────────────────────────────────────────────────
const subscribe = <P>(event: string, handler: (p: P) => void) => {
  let active = true;
  let attached = false;
  let s: Socket | null = null;

  (async () => {
    try {
      s = await getSocket();
      if (!active) return;
      s.on(event, handler as never);
      attached = true;
    } catch {
      /* abaikan — caller akan retry ketika layar refocus */
    }
  })();

  return () => {
    active = false;
    if (s && attached) s.off(event, handler as never);
  };
};

export const onMessageNew = (handler: (p: MessageNewPayload) => void) =>
  subscribe<MessageNewPayload>('message:new', handler);

export const onMessageRead = (handler: (p: MessageReadPayload) => void) =>
  subscribe<MessageReadPayload>('message:read', handler);

export const onTyping = (handler: (p: TypingPayload) => void) =>
  subscribe<TypingPayload>('typing', handler);

export const onPresenceUpdate = (handler: (p: PresenceUpdatePayload) => void) =>
  subscribe<PresenceUpdatePayload>('presence:update', handler);

export const onConversationBump = (handler: (p: ConversationBumpPayload) => void) =>
  subscribe<ConversationBumpPayload>('conversation:bump', handler);

export const onPatientCalled = (handler: (p: PatientCalledPayload) => void) =>
  subscribe<PatientCalledPayload>('patient:called', handler);
