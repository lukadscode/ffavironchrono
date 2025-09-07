import { useEffect, useState } from "react";
import axios from "@/lib/axios";

export function ServerClock() {
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    axios.get("/server-time").then(res => {
      const serverTime = new Date(res.data.time).getTime();
      const localTime = Date.now();
      setTimeOffset(serverTime - localTime);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const formatted = new Date(now + timeOffset).toLocaleTimeString("fr-FR", { hour12: false });

  return (
    <div className="font-mono text-xl">
      Heure serveur : <span className="font-bold">{formatted}</span>
    </div>
  );
}
