export const CrewStatus = {
  REGISTERED: "registered",
  DNS: "dns",
  DNF: "dnf",
  DISQUALIFIED: "disqualified",
  CHANGED: "changed",
  WITHDRAWN: "withdrawn",
} as const;

export type CrewStatus = typeof CrewStatus[keyof typeof CrewStatus];

export const CREW_STATUS_LABELS: Record<CrewStatus, string> = {
  [CrewStatus.REGISTERED]: "Inscrit",
  [CrewStatus.DNS]: "DNS (N'a pas pris le départ)",
  [CrewStatus.DNF]: "DNF (N'a pas terminé)",
  [CrewStatus.DISQUALIFIED]: "Disqualifié",
  [CrewStatus.CHANGED]: "Changement d'équipage",
  [CrewStatus.WITHDRAWN]: "Forfait",
};

// Statuts qui empêchent la participation
export const NON_PARTICIPATING_STATUSES: CrewStatus[] = [
  CrewStatus.DNS,
  CrewStatus.WITHDRAWN,
];

// Statuts qui indiquent une participation incomplète
export const INCOMPLETE_STATUSES: CrewStatus[] = [
  CrewStatus.DNF,
  CrewStatus.DISQUALIFIED,
];

// Tous les statuts valides
export const ALL_VALID_STATUSES = Object.values(CrewStatus);

// Vérifier si un statut est valide
export const isValidStatus = (status: string): status is CrewStatus => {
  return ALL_VALID_STATUSES.includes(status as CrewStatus);
};

// Vérifier si un équipage participe (status registered)
export const isParticipatingCrew = (status: string): boolean => {
  return status === CrewStatus.REGISTERED;
};

// Vérifier si un équipage ne participe pas
export const isNonParticipatingCrew = (status: string): boolean => {
  return NON_PARTICIPATING_STATUSES.includes(status as CrewStatus);
};

