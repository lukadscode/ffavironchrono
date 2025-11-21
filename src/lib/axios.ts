// src/lib/axios.ts
import axios from "axios";
import { refreshToken } from "@/api/auth";

const API_URL = "http://localhost:3010";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Injecte le token
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("authTokens");
  if (stored) {
    const { access_token } = JSON.parse(stored);
    if (access_token) {
      config.headers.Authorization = `Bearer ${access_token}`;
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
