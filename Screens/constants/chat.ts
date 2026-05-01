// Konstanta lama. Konfigurasi URL backend (HealthcareBot + Socket.IO) kini
// dibaca dari env Expo:
//
//   EXPO_PUBLIC_SOCKET_URL=http://192.168.1.7:4000
//   EXPO_PUBLIC_HEALTHBOT_URL=http://192.168.1.7:4000  (opsional, default ke SOCKET_URL)
//
// File ini dipertahankan untuk backward-compat impor lama; nilai di
// bawah ini hanya fallback dev terakhir saat env tidak ter-set.
export const CHAT_PROXY_URL =
  (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_HEALTHBOT_URL) ||
  (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_SOCKET_URL) ||
  'http://localhost:4000';
