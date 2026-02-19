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

/**
 * Formate un timestamp ISO 8601 avec millisecondes pour l'affichage chronométrage
 * @param timestamp - Timestamp ISO 8601 ou objet Date
 * @param showMilliseconds - Afficher les millisecondes (défaut: true)
 * @returns Timestamp formaté "HH:mm:ss.mmm" ou "HH:mm:ss"
 */
export function formatTimestamp(
  timestamp: string | Date | null | undefined,
  showMilliseconds: boolean = true
): string {
  if (!timestamp) return "--:--:--" + (showMilliseconds ? ".---" : "");

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "--:--:--" + (showMilliseconds ? ".---" : "");

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  if (showMilliseconds) {
    const milliseconds = date.getMilliseconds().toString().padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  } else {
    return `${hours}:${minutes}:${seconds}`;
  }
}

/**
 * Formate une durée en millisecondes au format chronométrage
 * @param milliseconds - Durée en millisecondes
 * @returns Format "mm:ss.mmm" ou "hh:mm:ss.mmm"
 */
export function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) return "--:--.---";

  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const msStr = ms.toString().padStart(3, "0");
  const secStr = seconds.toString().padStart(2, "0");
  const minStr = minutes.toString().padStart(2, "0");

  if (hours > 0) {
    const hourStr = hours.toString().padStart(2, "0");
    return `${hourStr}:${minStr}:${secStr}.${msStr}`;
  } else {
    return `${minStr}:${secStr}.${msStr}`;
  }
}

/**
 * Formate une différence de temps (écart) avec signe +/- et millisecondes
 * @param milliseconds - Différence en millisecondes
 * @returns Format "+mm:ss.mmm" ou "-mm:ss.mmm" ou "0.000"
 */
export function formatTimeDifference(milliseconds: number): string {
  if (milliseconds === 0) return "0.000";

  const absMs = Math.abs(milliseconds);
  const totalSeconds = Math.floor(absMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const ms = absMs % 1000;

  const sign = milliseconds < 0 ? "-" : "+";
  const msStr = ms.toString().padStart(3, "0");
  const secStr = seconds.toString().padStart(2, "0");

  if (minutes > 0) {
    const minStr = minutes.toString().padStart(2, "0");
    return `${sign}${minStr}:${secStr}.${msStr}`;
  } else {
    return `${sign}${secStr}.${msStr}`;
  }
}
