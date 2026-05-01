import { NativeModules, Platform } from 'react-native';

const BACKEND_PORT =
  (process.env.EXPO_PUBLIC_BACKEND_PORT as string | undefined) || '4000';

const LOCAL_HOST_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;

const getHostFromUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const match = String(url).match(/^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)/i);
  return match?.[1] || null;
};

const getExpoDevHost = (): string | null => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  const host = getHostFromUrl(scriptURL);
  if (!host) return null;
  return LOCAL_HOST_PATTERN.test(host) ? host : null;
};

export const getDefaultBackendUrl = () =>
  Platform?.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

export const resolveBackendUrl = (explicitUrl?: string, fallbackUrl = getDefaultBackendUrl()) => {
  const explicitHost = getHostFromUrl(explicitUrl);
  const expoDevHost = getExpoDevHost();
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

  if (isDev && expoDevHost && (!explicitUrl || LOCAL_HOST_PATTERN.test(explicitHost || ''))) {
    return `http://${expoDevHost}:${BACKEND_PORT}`;
  }

  return explicitUrl || fallbackUrl;
};
