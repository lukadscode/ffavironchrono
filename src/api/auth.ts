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
  try {
    const res = await api.post("/auth/register", data);
    return res.data;
  } catch (error: any) {
    // Si c'est une erreur 500 mais que les données ont peut-être été créées
    // On propage l'erreur mais avec plus d'informations
    if (error?.response?.status === 500) {
      // Vérifier si la réponse contient des données malgré l'erreur
      // (certains backends retournent des données même en cas d'erreur partielle)
      if (error?.response?.data?.data || error?.response?.data?.id) {
        // L'opération a partiellement réussi
        return {
          ...error.response.data,
          partialSuccess: true,
        };
      }
    }
    throw error;
  }
}

export async function requestPasswordReset(identifier: string) {
  return api.post("/auth/request-password-reset", { identifier });
}

export const fetchUserProfile = async () => {
  const res = await api.get("/auth/me"); // 🔐 Token injecté automatiquement
  return res.data; // Contient { status, data: { user, ... } }
};

export async function refreshToken(refresh_token: string) {
  // API: POST /auth/refresh-token { refresh_token }
  // Réponse: { status: "success", data: { access_token, refresh_token? } }
  const res = await api.post("/auth/refresh-token", { refresh_token });
  return res.data;
}

export async function verifyEmail(token: string) {
  const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  return res.data;
}

export async function resetPassword(token: string, password: string) {
  const res = await api.post("/auth/reset-password", { token, password });
  return res.data;
}