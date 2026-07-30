import api from "@/lib/axios";

export type CaptureMode = "lane_first" | "top_first" | "free_read" | "crew_follow";

export interface TimingProfile {
  id: string;
  event_id: string | null;
  name: string;
  allowed_capture_modes: CaptureMode[];
  default_capture_mode: CaptureMode;
  requires_lane_selection: boolean;
  allow_raw_capture: boolean;
  allow_status_shortcuts: boolean;
  allow_penalties: boolean;
  auto_start_on_first_detection: boolean;
  auto_dns_after_minutes: number | null;
  splits_enabled: boolean;
  is_default: boolean;
}

export type TimingProfileInput = Omit<TimingProfile, "id" | "event_id">;

export async function listTimingProfiles(eventId: string): Promise<TimingProfile[]> {
  const res = await api.get("/timing-profiles", { params: { event_id: eventId } });
  return res.data.data;
}

export async function createTimingProfile(
  eventId: string,
  data: TimingProfileInput
): Promise<TimingProfile> {
  const res = await api.post("/timing-profiles", { ...data, event_id: eventId });
  return res.data.data;
}

export async function updateTimingProfile(
  id: string,
  data: Partial<TimingProfileInput>
): Promise<TimingProfile> {
  const res = await api.put(`/timing-profiles/${id}`, data);
  return res.data.data;
}

export async function deleteTimingProfile(id: string): Promise<void> {
  await api.delete(`/timing-profiles/${id}`);
}

export async function setEventDefaultTimingProfile(
  eventId: string,
  timingProfileId: string | null
): Promise<void> {
  await api.put(`/events/${eventId}`, { timing_profile_id: timingProfileId });
}

export async function setRaceTimingProfile(
  raceId: string,
  timingProfileId: string | null
): Promise<void> {
  await api.put(`/races/${raceId}`, { timing_profile_id: timingProfileId });
}

export const CAPTURE_MODE_LABELS: Record<CaptureMode, string> = {
  lane_first: "Couloir → top",
  top_first: "Top → couloir",
  free_read: "Lecture libre",
  crew_follow: "Suivi équipage",
};
