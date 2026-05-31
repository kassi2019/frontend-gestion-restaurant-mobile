import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from './api';

// ==================== État connexion ====================
let isOnline = true;
const listeners: Array<(online: boolean) => void> = [];

// Vérifier l'état initial
NetInfo.fetch().then(state => {
  isOnline = state.isConnected ?? true;
  if (!isOnline) listeners.forEach(fn => fn(false));
});

// Écouter les changements
NetInfo.addEventListener(state => {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? true;
  listeners.forEach(fn => fn(isOnline));
  if (wasOffline && isOnline) syncQueue();
});

export function onConnectivityChange(fn: (online: boolean) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getIsOnline() { return isOnline; }

// ==================== File d'attente ====================
interface QueueItem {
  id: string;
  type: 'commande' | 'paiement';
  data: any;
  createdAt: string;
  retries: number;
}

async function getQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem('offline_queue');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(queue: QueueItem[]) {
  await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
}

export async function addToQueue(type: QueueItem['type'], data: any): Promise<string> {
  const queue = await getQueue();
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  queue.push({ id, type, data, createdAt: new Date().toISOString(), retries: 0 });
  await saveQueue(queue);
  return id;
}

export async function getQueueItems(): Promise<QueueItem[]> {
  return getQueue();
}

export async function getQueueCount(): Promise<number> {
  return (await getQueue()).length;
}

export async function removeFromQueue(id: string) {
  const queue = await getQueue();
  await saveQueue(queue.filter(q => q.id !== id));
}

// ==================== Synchronisation ====================
export async function syncQueue() {
  if (!isOnline) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'commande') {
        await api.post('/commandes', item.data);
      } else if (item.type === 'paiement') {
        await api.post(`/paiements/payer/${item.data.commandeId}`, { mode: item.data.mode });
      }
    } catch (err: any) {
      if (!err.response || err.code === 'ERR_NETWORK') {
        remaining.push({ ...item, retries: item.retries + 1 });
      } else if (err.response?.status >= 500) {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }
  }

  await saveQueue(remaining);
}

// Réessayer périodiquement
setInterval(() => { syncQueue(); }, 30000);
