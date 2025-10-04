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
