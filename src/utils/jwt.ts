import { jwtDecode } from "jwt-decode";

export interface JWTPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: any;
}

/**
 * Décode un token JWT et retourne son payload
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwtDecode<JWTPayload>(token);
  } catch (error) {
    console.error("Erreur lors du décodage du token:", error);
    return null;
  }
}

/**
 * Vérifie si un token est expiré
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  
  const expirationTime = decoded.exp * 1000; // Convertir en millisecondes
  return Date.now() >= expirationTime;
}

/**
 * Récupère la date d'expiration d'un token
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  
  return new Date(decoded.exp * 1000);
}

/**
 * Récupère le temps restant avant expiration d'un token (en millisecondes)
 */
export function getTokenTimeRemaining(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  
  const expirationTime = decoded.exp * 1000;
  const remaining = expirationTime - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Formate le temps restant en format lisible
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expiré";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} jour${days > 1 ? "s" : ""} ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}min`;
  } else if (minutes > 0) {
    return `${minutes}min ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Récupère la durée de validité totale d'un token (en millisecondes)
 */
export function getTokenDuration(token: string): number | null {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp || !decoded.iat) {
    return null;
  }
  
  return (decoded.exp - decoded.iat) * 1000;
}

