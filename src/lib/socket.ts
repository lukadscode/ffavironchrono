import { io, Socket } from "socket.io-client";

let socket: Socket;

export const initSocket = (): Socket => {
  if (!socket) {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";
    socket = io(API_URL);
  }
  return socket;
};

export const getSocket = () => socket;
