const STORAGE_KEY = "ffa_chrono_device_id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = `web-${crypto.randomUUID()}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `web-session-${Date.now()}`;
  }
}

export function getDeviceLabel(): string {
  const id = getDeviceId();
  return id.startsWith("web-") ? `Poste ${id.slice(4, 12)}` : id;
}
