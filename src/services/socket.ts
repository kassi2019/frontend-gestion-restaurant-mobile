import { playNotificationSound } from './sound';
import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { showToast } from './toast';

import { SERVER_URL } from '../config';

const SOCKET_URL = SERVER_URL;

let socket: Socket | null = null;

export function connectSocket() {
  const { user } = store.getState().auth;
  if (!user || socket?.connected) return;

  socket = io(SOCKET_URL, { transports: ['websocket'] });

  socket.on('connect', () => {
    socket!.emit('register', { userId: String(user.id), role: user.role });
    if (user.role === 'SERVEUR') {
      socket!.emit('joinTable', String(user.id));
    }
  });

  // Ecoute des evenements en temps reel
  socket.on('nouvelle_commande', (data: any) => {
    playNotificationSound(); showToast.warning(`Nouvelle commande • Table ${data.table?.numero || '?'}`);
  });

  socket.on('nouvelle_commande_cuisine', (data: any) => {
    playNotificationSound(); showToast.warning(`🍳 Cuisine • Nouvelle commande Table ${data.table?.numero || '?'}`);
  });

  socket.on('nouvelle_commande_bar', (data: any) => {
    playNotificationSound(); showToast.warning(`🍹 Bar • Nouvelle commande Table ${data.table?.numero || '?'}`);
  });

  socket.on('commande_status_change', (data: any) => {
    const label = data.label || data.statut;
    playNotificationSound(); showToast.success(`Table ${data.tableNumero} → ${label}`);
  });

  socket.on('notification_admin', (data: any) => {
    playNotificationSound(); showToast.warning(data.message || 'Notification admin');
  });

  socket.on('commande_prete', (data: any) => {
    playNotificationSound(); showToast.success(`📢 ${data.message || 'Commande prête — Table ' + (data.tableNumero || '?')}`);
  });

  socket.on('demande_facture', (data: any) => {
    playNotificationSound(); showToast.warning(`🧾 Demande d'addition — Table ${data.tableNumero || '?'}`);
  });

  socket.on('notification_user', (data: any) => {
    playNotificationSound(); showToast.warning(data.message || 'Notification');
  });

  socket.on('connect_error', () => {
    // reconnexion automatique gérée par socket.io
  });

  socket.on('disconnect', () => {
    // reconnexion automatique gérée par socket.io
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
