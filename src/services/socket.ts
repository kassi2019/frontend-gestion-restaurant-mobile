import { io, Socket } from 'socket.io-client';
import { store } from '../store';

const SOCKET_URL = 'http://192.168.1.7:3000';

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

  socket.on('disconnect', () => { /* reconnexion automatique */ });

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
