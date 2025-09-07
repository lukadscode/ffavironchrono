import { io, Socket } from "socket.io-client";

let socket: Socket;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io("http://localhost:3010"); // <-- Mets ici l'adresse de ton backend
  }
  return socket;
};

export const getSocket = () => socket;
