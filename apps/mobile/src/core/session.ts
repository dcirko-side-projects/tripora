import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { SessionClient } from './sessionClient';

const url = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:5080').replace(/\/+$/, '');
if (!/^https?:\/\//.test(url) || (!__DEV__ && !url.startsWith('https://')))
  throw new Error('API mora koristiti HTTPS izvan razvojnog okruženja.');
export const sessionClient = new SessionClient(url, {
  read: () => SecureStore.getItemAsync('tripora.session.v1'),
  write: value => SecureStore.setItemAsync('tripora.session.v1', value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync('tripora.session.v1'),
}, value => digestStringAsync(CryptoDigestAlgorithm.SHA256, value));
