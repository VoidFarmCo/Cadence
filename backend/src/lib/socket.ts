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

/**
 * Emit an event scoped to a specific company room.
 * Falls back to no-op if Socket.io isn't initialized.
 */
export function emitToCompany(companyId: string | null | undefined, event: string, data: unknown): void {
  if (!io || !companyId) return;
  io.to(`company:${companyId}`).emit(event, data);
}
