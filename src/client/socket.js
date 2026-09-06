import { io } from 'socket.io-client';

export function createClientSocket(serverUrl = window.location.origin) {
  return io(serverUrl, {
    transports: ['websocket'],
  });
}