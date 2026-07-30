import api from "@/lib/axios";

export type FinishLynxPreviewRow = {
  lane: number | null;
  place: string | null;
  time_raw: string | null;
  time_ms: number | null;
  finish_timestamp: string | null;
  status: string | null;
  competitor_name: string;
  affiliation: string;
  crew_id: string | null;
  crew_label: string | null;
  action: "import" | "status" | "skip" | "error";
  message: string | null;
};

export type FinishLynxPreview = {
  event: {
    eventNumber: string | null;
    roundNumber: string | null;
    heatNumber: number | null;
    eventName: string | null;
    startTimeRaw: string | null;
  };
  race: {
    id: string;
    name: string | null;
    race_number: number | null;
    status: string;
    start_time: string | null;
  };
  finish_point: {
    id: string;
    label: string;
  };
  heat_matches: boolean;
  rows: FinishLynxPreviewRow[];
  summary: {
    total: number;
    to_import: number;
    status_updates: number;
    errors: number;
    skipped: number;
  };
};

export type FinishLynxImportResult = FinishLynxPreview["summary"] & {
  imported: number;
  race_status: string;
  results: Array<
    FinishLynxPreviewRow & {
      result: string;
      timing_id?: string;
    }
  >;
};

export async function previewFinishLynx(
  raceId: string,
  file: File
): Promise<FinishLynxPreview> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post(`/races/${raceId}/finishlynx/preview`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data.data;
}

export async function importFinishLynx(
  raceId: string,
  file: File,
  replaceExisting = false
): Promise<FinishLynxImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replace_existing", String(replaceExisting));

  const res = await api.post(`/races/${raceId}/finishlynx/import`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data.data;
}
