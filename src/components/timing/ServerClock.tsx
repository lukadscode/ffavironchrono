import { useEffect, useState, useCallback } from "react";
import api from "@/lib/axios";

const SYNC_INTERVAL_MS = 60_000;

export function ServerClock() {
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());

  const syncClock = useCallback(async () => {
    try {
      const clientTime = new Date().toISOString();
      const res = await api.get("/server-time-offset", {
        params: { client_time: clientTime },
      });
      const serverTime = new Date(res.data.server_time).getTime();
      const offset =
        typeof res.data.offset_ms === "number"
          ? res.data.offset_ms
          : serverTime - Date.now();
      setTimeOffset(offset);
    } catch {
      const res = await api.get("/server-time");
      const serverTime = new Date(res.data.server_time).getTime();
      setTimeOffset(serverTime - Date.now());
    }
  }, []);

  useEffect(() => {
    syncClock();
    const interval = setInterval(syncClock, SYNC_INTERVAL_MS);
    const onOnline = () => syncClock();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [syncClock]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const formatted = new Date(now + timeOffset).toLocaleTimeString("fr-FR", {
    hour12: false,
  });

  return (
    <div className="font-mono text-xl">
      Heure serveur : <span className="font-bold">{formatted}</span>
    </div>
  );
}
