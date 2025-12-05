import { publicApi } from "@/lib/axios";

type Club = {
  id: string;
  nom: string;
  nom_court: string | null;
  code: string;
  code_court: string | null;
  etat: string | null;
  type: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

// Cache pour éviter trop d'appels API
let clubsCache: Map<string, Club> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère tous les clubs et met en cache
 */
export async function fetchAllClubs(forceRefresh = false): Promise<Club[]> {
  const now = Date.now();

  // Utiliser le cache si valide et pas de refresh forcé
  if (
    !forceRefresh &&
    clubsCache &&
    now - cacheTimestamp < CACHE_DURATION
  ) {
    return Array.from(clubsCache.values());
  }

  try {
    const res = await publicApi.get("/clubs");
    const clubs = res.data.data || [];

    // Mettre en cache par code
    clubsCache = new Map();
    clubs.forEach((club: Club) => {
      clubsCache!.set(club.code, club);
    });
    cacheTimestamp = now;

    return clubs;
  } catch (error: any) {
    console.error("Erreur récupération clubs", error);
    throw error;
  }
}

/**
 * Récupère un club par son code
 */
export async function getClubByCode(code: string): Promise<Club | null> {
  try {
    // Essayer d'abord le cache
    if (clubsCache && clubsCache.has(code)) {
      return clubsCache.get(code) || null;
    }

    // Sinon, récupérer tous les clubs pour remplir le cache
    await fetchAllClubs();

    return clubsCache?.get(code) || null;
  } catch (error) {
    console.error("Erreur récupération club par code", error);
    return null;
  }
}

/**
 * Récupère le code court d'un club par son code
 * Retourne le code court si disponible, sinon retourne le code
 */
export async function getClubShortCode(code: string): Promise<string> {
  if (!code) return code;

  try {
    const club = await getClubByCode(code);
    return club?.code_court || code;
  } catch (error) {
    console.error("Erreur récupération code court", error);
    return code;
  }
}

/**
 * Récupère le code court d'un club de manière synchrone (utilise le cache)
 * Si le cache n'est pas disponible, retourne le code tel quel
 */
export function getClubShortCodeSync(code: string): string {
  if (!code || !clubsCache) return code;

  const club = clubsCache.get(code);
  return club?.code_court || code;
}

/**
 * Initialise le cache en récupérant tous les clubs
 * Utile à appeler au démarrage de l'application
 */
export async function initializeClubsCache(): Promise<void> {
  try {
    await fetchAllClubs(true);
  } catch (error) {
    console.error("Erreur initialisation cache clubs", error);
  }
}

/**
 * Vide le cache des clubs
 */
export function clearClubsCache(): void {
  clubsCache = null;
  cacheTimestamp = 0;
}

/**
 * Récupère un club par son code court
 */
export async function getClubByShortCode(codeCourt: string): Promise<Club | null> {
  try {
    const clubs = await fetchAllClubs();
    return clubs.find((club) => club.code_court === codeCourt) || null;
  } catch (error) {
    console.error("Erreur récupération club par code court", error);
    return null;
  }
}

