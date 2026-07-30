import api from "@/lib/axios";

export interface PhaseResult {
  crew_id: string;
  crew: {
    id: string;
    club_name: string;
    club_code: string;
    category_id: string;
    category_label: string | null;
  };
  race: {
    id: string;
    name: string;
    race_number: number;
  };
  lane: number;
  finish_time: string | null;
  duration_ms: number | null;
  has_timing: boolean;
  rank_in_race: number | null;
  rank_scratch: number | null;
}

export interface PhaseResultsResponse {
  data: PhaseResult[];
}

export interface PhaseResultsByCategory {
  data: Record<string, PhaseResult[]>;
}

export const getPhaseResults = async (phaseId: string): Promise<PhaseResultsResponse> => {
  const response = await api.get(`/race-phases/${phaseId}/results`);
  return response.data;
};

export const getPhaseResultsByCategory = async (phaseId: string): Promise<PhaseResultsByCategory> => {
  const response = await api.get(`/race-phases/${phaseId}/results?groupByCategory=true`);
  return response.data;
};

export const gunStart = async (raceId: string, startTime?: string) => {
  const response = await api.post(`/races/${raceId}/gun-start`, {
    start_time: startTime,
  });
  return response.data;
};

export const falseStart = async (raceId: string) => {
  const response = await api.post(`/races/${raceId}/false-start`);
  return response.data;
};

export const updateRaceCrewAdjustment = async (
  raceCrewId: string,
  adjustment_ms: number,
  adjustment_reason?: string
) => {
  const response = await api.patch(`/race-crews/${raceCrewId}/adjustment`, {
    adjustment_ms,
    adjustment_reason,
  });
  return response.data;
};

export const updateRaceCrewStatus = async (raceCrewId: string, status: string) => {
  const response = await api.patch(`/race-crews/${raceCrewId}/status`, { status });
  return response.data;
};

export interface RaceResultRow {
  crew_id: string;
  race_crew_id: string;
  lane: number;
  status: string;
  adjustment_ms: number;
  adjustment_reason: string | null;
  raw_duration_ms: number | null;
  club_name: string | null;
  club_code: string | null;
  category: {
    id: string;
    code: string;
    label: string;
    age_group: string;
    gender: string;
  } | null;
  finish_time: string | null;
  final_time: string | null;
  has_timing: boolean;
  position: number | null;
}

export const getRaceResults = async (raceId: string): Promise<RaceResultRow[]> => {
  const response = await api.get(`/races/results/${raceId}`);
  return response.data.data || [];
};

export const validateRace = async (raceId: string) => {
  const response = await api.post(`/races/${raceId}/validate`);
  return response.data;
};
