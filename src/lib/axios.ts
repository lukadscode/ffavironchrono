// src/lib/axios.ts
import axios from "axios";
import { refreshToken } from "@/api/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";
// Token API statique (optionnel) pour les requêtes qui nécessitent un Bearer initial
// Définir dans .env : VITE_API_BEARER_TOKEN=votre_token_ici
const API_BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN || null;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Injecte le token (sauf pour les endpoints publics)
api.interceptors.request.use((config) => {
  // Liste des endpoints qui ne nécessitent PAS de token Bearer
  const publicEndpoints = [
    "/auth/login",
    "/auth/register",
    "/auth/request-password-reset",
    "/auth/verify-email",
    "/auth/reset-password",
  ];

  // Pour les endpoints publics, utiliser uniquement le token API statique si présent
  const isPublicEndpoint = publicEndpoints.some(endpoint =>
    config.url?.includes(endpoint)
  );

  if (isPublicEndpoint) {
    // Pour les endpoints publics, utiliser le token API statique si présent
    if (API_BEARER_TOKEN && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${API_BEARER_TOKEN}`;
    }
    return config;
  }

  // Pour les autres endpoints, priorité au token utilisateur, sinon token API statique
  const stored = localStorage.getItem("authTokens");
  if (stored) {
    try {
      const { access_token } = JSON.parse(stored);
      if (access_token) {
        // Le token utilisateur remplace le token API statique
        config.headers.Authorization = `Bearer ${access_token}`;
      } else {
        console.warn("⚠️ Token d'accès manquant dans localStorage");
        // Si pas de token utilisateur mais qu'on a un token API statique, l'utiliser
        if (API_BEARER_TOKEN && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${API_BEARER_TOKEN}`;
        }
      }
    } catch (e) {
      console.error("❌ Erreur parsing authTokens:", e);
      // En cas d'erreur, essayer d'utiliser le token API statique
      if (API_BEARER_TOKEN && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${API_BEARER_TOKEN}`;
      }
    }
  } else {
    // Si pas de token utilisateur, utiliser le token API statique s'il existe
    if (API_BEARER_TOKEN && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${API_BEARER_TOKEN}`;
    } else if (!API_BEARER_TOKEN) {
      console.warn("⚠️ Aucun token d'authentification trouvé dans localStorage");
    }
  }
  return config;
});

// 🔁 Interceptor de réponse pour gérer les 401
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem("authTokens")
    ) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const stored = JSON.parse(localStorage.getItem("authTokens")!);
        const refreshed = await refreshToken(stored.refresh_token);

        localStorage.setItem("authTokens", JSON.stringify(refreshed));

        api.defaults.headers.common.Authorization = `Bearer ${refreshed.access_token}`;
        onTokenRefreshed(refreshed.access_token);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${refreshed.access_token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        isRefreshing = false;
        localStorage.removeItem("authTokens");
        window.location.href = "/admin/login"; // ⏱ déconnexion automatique
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

// Instance axios publique (sans authentification) pour les pages publiques
export const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
