'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const serverEnvPath = path.join(serverDir, '.env');
const isWindows = process.platform === 'win32';

const requestedExpoArgs = process.argv.slice(2);
const hasExpoHostMode = requestedExpoArgs.some(
  (arg) =>
    arg === '--lan' ||
    arg === '--localhost' ||
    arg === '--tunnel' ||
    arg.startsWith('--host')
);
const expoArgs = ['start', ...requestedExpoArgs, ...(hasExpoHostMode ? [] : ['--lan'])];
const children = new Set();
let shuttingDown = false;

const readServerPort = () => {
  if (!fs.existsSync(serverEnvPath)) return 4000;
  const envText = fs.readFileSync(serverEnvPath, 'utf8');
  const match = envText.match(/^PORT\s*=\s*(.+)$/m);
  const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : 4000;
};

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(700, () => {
      socket.destroy();
      resolve(false);
    });
  });

const findLanAddress = () => {
  const blockedInterface = /(loopback|virtual|vmware|vbox|hyper-v|wsl|docker|bluetooth)/i;
  const candidates = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    if (blockedInterface.test(name)) continue;
    for (const address of addresses || []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      const ip = address.address;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) {
        candidates.push(ip);
      }
    }
  }

  return candidates.find((ip) => ip.startsWith('192.168.')) || candidates[0] || null;
};

const applyDevBackendEnv = (serverPort) => {
  const lanAddress = findLanAddress();
  const host = lanAddress || 'localhost';
  const backendUrl = `http://${host}:${serverPort}`;

  process.env.EXPO_PUBLIC_SOCKET_URL = backendUrl;
  process.env.EXPO_PUBLIC_HEALTHBOT_URL = backendUrl;
  process.env.EXPO_PUBLIC_BACKEND_PORT = String(serverPort);

  process.stdout.write(`[dev] Client backend URL: ${backendUrl}\n`);
  if (!lanAddress) {
    process.stdout.write(
      '[dev] Warning: IP LAN tidak terdeteksi. Untuk HP fisik, pastikan laptop dan HP ada di Wi-Fi yang sama.\n'
    );
  }
};

const prefixStream = (stream, label) => {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.length) process.stdout.write(`[${label}] ${line}\n`);
      else process.stdout.write('\n');
    }
  });
  stream.on('end', () => {
    if (buffer.length) process.stdout.write(`[${label}] ${buffer}\n`);
  });
};

const spawnChild = (label, command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: !!options.shell,
  });

  children.add(child);
  prefixStream(child.stdout, label);
  prefixStream(child.stderr, label);

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;
    const suffix = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`[dev] ${label} exited with ${suffix}\n`);
    stopAll(code || 0);
  });

  return child;
};

const stopAll = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
};

const resolveExpoCommand = () => {
  const localExpoCli = path.join(rootDir, 'node_modules', 'expo', 'bin', 'cli');
  if (fs.existsSync(localExpoCli)) {
    return { command: process.execPath, args: [localExpoCli, ...expoArgs] };
  }
  return {
    command: isWindows ? 'npx.cmd' : 'npx',
    args: ['expo', ...expoArgs],
    shell: isWindows,
  };
};

const main = async () => {
  const serverPort = readServerPort();
  applyDevBackendEnv(serverPort);

  if (!fs.existsSync(serverEnvPath)) {
    process.stdout.write(
      '[dev] Warning: server/.env belum ada. Server tetap dicoba, tapi HealthcareBot/Socket.IO butuh env server.\n'
    );
  }

  const serverAlreadyRunning = await isPortOpen(serverPort);
  if (serverAlreadyRunning) {
    process.stdout.write(
      `[dev] Server port ${serverPort} sudah aktif, tidak start server kedua.\n`
    );
  } else {
    spawnChild('server', process.execPath, ['--watch', 'src/index.js'], {
      cwd: serverDir,
    });
  }

  const expo = resolveExpoCommand();
  spawnChild('expo', expo.command, expo.args, {
    cwd: rootDir,
    shell: expo.shell,
  });
};

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

main().catch((error) => {
  process.stderr.write(`[dev] Failed to start: ${error?.message || error}\n`);
  stopAll(1);
});
