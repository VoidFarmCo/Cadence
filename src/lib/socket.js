import { io } from 'socket.io-client';
import { getAccessToken } from '@/utils/auth';

let socket = null;

export function getSocket() {
  if (socket) return socket;

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  socket = io(apiUrl, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: (cb) => {
      // Called on every connect/reconnect — always sends fresh token
      cb({ token: getAccessToken() });
    },
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
