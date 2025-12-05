/**
 * Formate un temps en secondes vers un format lisible (MM:SS ou HH:MM:SS)
 * @param seconds - Temps en secondes (peut être null ou undefined)
 * @returns String formatée ou null si pas de temps
 */
export function formatTempsPronostique(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}

