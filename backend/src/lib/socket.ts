import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export function initSocket(server: SocketServer): void {
  io = server;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
