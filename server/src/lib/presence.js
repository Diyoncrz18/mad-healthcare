'use strict';

/**
 * In-memory presence registry.
 *
 * Disimpan sebagai Map<userId, Set<socketId>> agar mendukung satu user
 * yang login dari beberapa device.
 *
 * Online      = ukuran Set > 0.
 * Disconnect  = hapus socketId; jika Set kosong, anggap user offline.
 *
 * `add` mengembalikan true jika user transisi 0→1 (baru online); false
 * jika menambah socket pada user yang sudah online. Ini memungkinkan
 * caller untuk menghindari broadcast `online=true` berulang.
 */
const sockets = new Map();

function add(userId, socketId) {
  let set = sockets.get(userId);
  let firstConnection = false;
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
    firstConnection = true;
  }
  set.add(socketId);
  return firstConnection;
}

function remove(userId, socketId) {
  const set = sockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  const offline = set.size === 0;
  if (offline) sockets.delete(userId);
  return offline;
}

function isOnline(userId) {
  const set = sockets.get(userId);
  return !!set && set.size > 0;
}

function onlineUserIds() {
  return Array.from(sockets.keys());
}

module.exports = { add, remove, isOnline, onlineUserIds };
