// src/api/auth.ts
import api from "@/lib/axios";

export async function login(identifier: string, password: string) {
  const res = await api.post("/auth/login", { identifier, password });
  return res.data; // { access_token, refresh_token, ... }
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  num_license?: string;
}) {
  const res = await api.post("/auth/register", data);
  return res.data;
}

export async function requestPasswordReset(identifier: string) {
  return api.post("/auth/request-password-reset", { identifier });
}

export const fetchUserProfile = async () => {
  const res = await api.get("/auth/me"); // 🔐 Token injecté automatiquement
  return res.data; // Contient { status, data: { user, ... } }
};

export async function refreshToken(refresh_token: string) {
  const res = await api.post("/auth/refresh", { refresh_token });
  return res.data; // doit renvoyer un nouvel access_token
}