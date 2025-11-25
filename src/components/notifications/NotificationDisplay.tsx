import { useEffect, useState } from "react";
import { initSocket, getSocket } from "@/lib/socket";
import { publicApi } from "@/lib/axios";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  event_id: string | null;
  race_id: string | null;
  message: string;
  importance: "info" | "warning" | "error" | "success";
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface NotificationDisplayProps {
  eventId?: string;
  raceId?: string;
  className?: string;
  maxNotifications?: number;
}

export default function NotificationDisplay({
  eventId,
  raceId,
  className,
  maxNotifications = 5,
}: NotificationDisplayProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!eventId && !raceId) return;

    // Initialiser le socket
    initSocket();
    const socket = getSocket();

    // Rejoindre les rooms
    if (eventId) {
      socket.emit("joinPublicEvent", { event_id: eventId });
    }
    if (raceId) {
      socket.emit("joinRoom", { race_id: raceId });
    }

    // Charger les notifications existantes
    const fetchNotifications = async () => {
      try {
        const url = raceId
          ? `/notifications/race/${raceId}`
          : eventId
          ? `/notifications/event/${eventId}`
          : null;

        if (url) {
          const response = await publicApi.get(url);
          const fetchedNotifications = response.data.data || [];
          setNotifications(fetchedNotifications);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des notifications:", error);
      }
    };

    fetchNotifications();

    // Écouter les nouvelles notifications
    socket.on("notification:new", (data: Notification) => {
      setNotifications((prev) => {
        // Vérifier si la notification n'existe pas déjà
        if (prev.some((n) => n.id === data.id)) return prev;
        return [data, ...prev].slice(0, maxNotifications);
      });
    });

    // Écouter les mises à jour
    socket.on("notification:updated", (data: Notification) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === data.id ? data : n))
      );
    });

    // Écouter les suppressions
    socket.on("notification:removed", (data: { id: string }) => {
      setNotifications((prev) => prev.filter((n) => n.id !== data.id));
      setDismissedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(data.id);
        return newSet;
      });
    });

    return () => {
      if (eventId) {
        socket.emit("leavePublicEvent", { event_id: eventId });
      }
      if (raceId) {
        socket.emit("leaveRoom", { race_id: raceId });
      }
      socket.off("notification:new");
      socket.off("notification:updated");
      socket.off("notification:removed");
    };
  }, [eventId, raceId, maxNotifications]);

  const getNotificationIcon = (importance: string) => {
    switch (importance) {
      case "error":
        return <XCircle className="w-5 h-5" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" />;
      case "success":
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (importance: string) => {
    switch (importance) {
      case "error":
        return "border-red-500 bg-red-50 text-red-900";
      case "warning":
        return "border-orange-500 bg-orange-50 text-orange-900";
      case "success":
        return "border-green-500 bg-green-50 text-green-900";
      default:
        return "border-blue-500 bg-blue-50 text-blue-900";
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const visibleNotifications = notifications.filter(
    (n) => !dismissedIds.has(n.id) && n.is_active
  );

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {visibleNotifications.map((notification) => (
        <Alert
          key={notification.id}
          className={cn(
            "relative border-l-4 shadow-sm animate-in slide-in-from-top-2",
            getNotificationColor(notification.importance)
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.importance)}
            </div>
            <div className="flex-1 min-w-0">
              <AlertDescription className="text-sm font-medium whitespace-pre-wrap break-words">
                {notification.message}
              </AlertDescription>
            </div>
            <button
              onClick={() => handleDismiss(notification.id)}
              className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Fermer la notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Alert>
      ))}
    </div>
  );
}

