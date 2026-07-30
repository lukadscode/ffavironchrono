import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play,
  Square,
  Activity,
  Send,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminPage } from "@/components/layout/AdminPage";

type WebSocketState = "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED";

type RaceStatus = {
  state: number;
  state_desc: string;
  data?: Array<{ lane?: number; [key: string]: any }>;
};

type Message = {
  time: string;
  data: string;
  type: "sent" | "received" | "system";
  parsed?: any;
  messageType?: "race_status" | "json" | "text";
};

const RACE_STATES: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: "Warmup", color: "text-blue-700", bgColor: "bg-blue-100" },
  2: { label: "Stop Rowing", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  3: { label: "Ready", color: "text-green-700", bgColor: "bg-green-100" },
  4: { label: "Sit Ready", color: "text-purple-700", bgColor: "bg-purple-100" },
  5: { label: "Attention", color: "text-orange-700", bgColor: "bg-orange-100" },
  6: { label: "Row", color: "text-red-700", bgColor: "bg-red-100" },
  7: { label: "False Start", color: "text-red-800", bgColor: "bg-red-200" },
  8: { label: "Technical Hold", color: "text-yellow-800", bgColor: "bg-yellow-200" },
  9: { label: "Race Running", color: "text-green-800", bgColor: "bg-green-200" },
  10: { label: "Race Aborted", color: "text-red-900", bgColor: "bg-red-300" },
  11: { label: "Race Complete", color: "text-blue-800", bgColor: "bg-blue-200" },
  12: { label: "Final Results", color: "text-green-900", bgColor: "bg-green-300" },
  13: { label: "Inactive", color: "text-gray-700", bgColor: "bg-gray-100" },
  14: { label: "Exchange", color: "text-indigo-700", bgColor: "bg-indigo-100" },
};

export default function WebSocketTestPage() {
  const { toast } = useToast();
  const [wsUri, setWsUri] = useState("ws://localhost:443");
  const [isConnected, setIsConnected] = useState(false);
  const [socketState, setSocketState] = useState<WebSocketState>("CLOSED");
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageToSend, setMessageToSend] = useState("");
  const [nickname, setNickname] = useState("");
  const [currentRaceStatus, setCurrentRaceStatus] = useState<RaceStatus | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const getStateString = (state: number): WebSocketState => {
    switch (state) {
      case WebSocket.CONNECTING:
        return "CONNECTING";
      case WebSocket.OPEN:
        return "OPEN";
      case WebSocket.CLOSING:
        return "CLOSING";
      case WebSocket.CLOSED:
        return "CLOSED";
      default:
        return "CLOSED";
    }
  };

  const getStateColor = (state: WebSocketState) => {
    switch (state) {
      case "CONNECTING":
        return "bg-yellow-500";
      case "OPEN":
        return "bg-green-500";
      case "CLOSING":
        return "bg-orange-500";
      case "CLOSED":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const parseMessage = (data: string): { parsed?: any; messageType: "race_status" | "json" | "text" } => {
    try {
      const parsed = JSON.parse(data);
      
      // Vérifier si c'est un message race_status
      if (parsed.race_status || (parsed.state !== undefined && parsed.state_desc !== undefined)) {
        const raceStatus: RaceStatus = parsed.race_status || parsed;
        setCurrentRaceStatus(raceStatus);
        return { parsed: raceStatus, messageType: "race_status" };
      }
      
      return { parsed, messageType: "json" };
    } catch {
      return { messageType: "text" };
    }
  };

  const addMessage = (data: string, type: "sent" | "received" | "system" = "received") => {
    const time = new Date().toLocaleTimeString();
    const { parsed, messageType } = parseMessage(data);
    setMessages((prev) => [...prev, { time, data, type, parsed, messageType }]);
  };

  const initWebSocket = () => {
    if (!wsUri.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une URL WebSocket",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fermer la connexion existante si elle existe
      if (websocketRef.current && websocketRef.current.readyState !== WebSocket.CLOSED) {
        websocketRef.current.close();
      }

      // Créer une nouvelle connexion WebSocket
      const ws = new WebSocket(wsUri.trim());
      websocketRef.current = ws;

      ws.onopen = (evt) => {
        console.log("✅ WebSocket connecté");
        setIsConnected(true);
        setSocketState("OPEN");
        addMessage("CONNECTED", "system");
        toast({
          title: "Connecté",
          description: "Connexion WebSocket établie avec succès",
        });
      };

      ws.onclose = (evt) => {
        console.log("❌ WebSocket déconnecté", evt);
        setIsConnected(false);
        setSocketState("CLOSED");
        addMessage("DISCONNECTED", "system");
        toast({
          title: "Déconnecté",
          description: "Connexion WebSocket fermée",
        });
      };

      ws.onmessage = (evt) => {
        console.log("📨 Message reçu:", evt.data);
        addMessage(evt.data, "received");
      };

      ws.onerror = (evt) => {
        console.error("❌ Erreur WebSocket:", evt);
        addMessage("ERROR: Erreur de connexion WebSocket", "system");
        toast({
          title: "Erreur",
          description: "Une erreur est survenue avec la connexion WebSocket",
          variant: "destructive",
        });
      };

      setSocketState("CONNECTING");
      addMessage("Tentative de connexion...", "system");
    } catch (exception: any) {
      console.error("❌ Exception:", exception);
      addMessage("ERROR: " + exception.message, "system");
      toast({
        title: "Erreur",
        description: exception.message || "Impossible de créer la connexion WebSocket",
        variant: "destructive",
      });
    }
  };

  const stopWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  };

  const checkSocket = () => {
    if (websocketRef.current) {
      const state = getStateString(websocketRef.current.readyState);
      setSocketState(state);
      addMessage(`WebSocket state = ${websocketRef.current.readyState} (${state})`, "system");
    } else {
      addMessage("WebSocket is null", "system");
    }
  };

  const sendMessage = () => {
    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Erreur",
        description: "WebSocket n'est pas connecté",
        variant: "destructive",
      });
      return;
    }

    if (!messageToSend.trim()) {
      return;
    }

    const strToSend = nickname.trim() ? `${nickname}: ${messageToSend}` : messageToSend;
    websocketRef.current.send(strToSend);
    addMessage(strToSend, "sent");
    setMessageToSend("");
    console.log("📤 Message envoyé:", strToSend);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: "Message copié dans le presse-papiers",
    });
  };

  // Nettoyer la connexion à la fermeture du composant
  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  return (
    <AdminPage
      title="Test WebSocket"
      description="Connectez-vous à un serveur WebSocket pour recevoir des données en temps réel."
      icon={Activity}
    >
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wsUri">URL WebSocket</Label>
            <Input
              id="wsUri"
              value={wsUri}
              onChange={(e) => setWsUri(e.target.value)}
              placeholder="ws://localhost:443 ou wss://example.com"
              disabled={isConnected}
            />
            <p className="text-xs text-muted-foreground">
              Note: Modifiez l'URL selon votre configuration (ws:// pour non sécurisé, wss:// pour sécurisé)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={initWebSocket}
              disabled={isConnected}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Connecter
            </Button>
            <Button
              onClick={stopWebSocket}
              disabled={!isConnected}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Déconnecter
            </Button>
            <Button
              onClick={checkSocket}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              État
            </Button>
          </div>

          {/* État de la connexion */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStateColor(socketState)}`}></div>
              <span className="text-sm font-medium">État:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                socketState === "OPEN" 
                  ? "bg-green-100 text-green-700" 
                  : socketState === "CONNECTING"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}>
                {socketState}
              </span>
            </div>
            {socketState === "OPEN" && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">Connecté</span>
              </div>
            )}
            {socketState === "CLOSED" && (
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Déconnecté</span>
              </div>
            )}
            {socketState === "CONNECTING" && (
              <div className="flex items-center gap-1 text-yellow-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Connexion en cours...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statut de course actuel */}
      {currentRaceStatus && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Statut de course actuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">État:</span>
                {(() => {
                  const stateInfo = RACE_STATES[currentRaceStatus.state] || {
                    label: `État ${currentRaceStatus.state}`,
                    color: "text-gray-700",
                    bgColor: "bg-gray-100",
                  };
                  return (
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${stateInfo.bgColor} ${stateInfo.color}`}>
                      {stateInfo.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Description:</span>
                <span className="text-sm text-muted-foreground">{currentRaceStatus.state_desc}</span>
              </div>
              {currentRaceStatus.data && currentRaceStatus.data.length > 0 && (
                <div>
                  <span className="text-sm font-medium block mb-2">Données:</span>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(currentRaceStatus.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Messages ({messages.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Effacer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg bg-slate-50 p-4 h-96 overflow-y-auto font-mono text-sm">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>Aucun message reçu</p>
                <p className="text-xs mt-2">Les messages apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      msg.type === "sent"
                        ? "bg-blue-50 border-blue-500"
                        : msg.type === "system"
                        ? "bg-yellow-50 border-yellow-500"
                        : msg.messageType === "race_status"
                        ? "bg-purple-50 border-purple-500"
                        : msg.messageType === "json"
                        ? "bg-indigo-50 border-indigo-500"
                        : "bg-green-50 border-green-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{msg.time}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            msg.type === "sent"
                              ? "bg-blue-100 text-blue-700"
                              : msg.type === "system"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {msg.type === "sent"
                              ? "ENVOYÉ"
                              : msg.type === "system"
                              ? "SYSTÈME"
                              : "REÇU"}
                          </span>
                          {msg.messageType === "race_status" && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              RACE_STATUS
                            </span>
                          )}
                          {msg.messageType === "json" && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                              JSON
                            </span>
                          )}
                        </div>
                        
                        {/* Affichage spécial pour race_status */}
                        {msg.messageType === "race_status" && msg.parsed && (
                          <div className="mb-2 p-2 bg-white rounded border">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">État:</span>
                                {(() => {
                                  const raceStatus = msg.parsed as RaceStatus;
                                  const stateInfo = RACE_STATES[raceStatus.state] || {
                                    label: `État ${raceStatus.state}`,
                                    color: "text-gray-700",
                                    bgColor: "bg-gray-100",
                                  };
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateInfo.bgColor} ${stateInfo.color}`}>
                                      {stateInfo.label} ({raceStatus.state})
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold">Description:</span>
                                <span className="text-xs text-muted-foreground">{(msg.parsed as RaceStatus).state_desc}</span>
                              </div>
                              {(msg.parsed as RaceStatus).data && (msg.parsed as RaceStatus).data!.length > 0 && (
                                <div className="mt-1">
                                  <span className="text-xs font-semibold">Données:</span>
                                  <pre className="text-xs mt-1 bg-slate-50 p-1 rounded overflow-x-auto">
                                    {JSON.stringify((msg.parsed as RaceStatus).data, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Affichage pour JSON normal */}
                        {msg.messageType === "json" && msg.parsed && (
                          <div className="mb-2 p-2 bg-white rounded border">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(msg.parsed, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Affichage du message brut */}
                        <p className="break-words text-xs">{msg.data}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(msg.data)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Envoi de messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Envoyer un message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Pseudo (optionnel)</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Votre pseudo"
              disabled={!isConnected}
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Tapez votre message et appuyez sur Entrée..."
              value={messageToSend}
              onChange={(e) => setMessageToSend(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={!isConnected}
            />
            <Button
              onClick={sendMessage}
              disabled={!isConnected || !messageToSend.trim()}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Envoyer
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: L'envoi de messages n'est disponible que si le serveur WebSocket le supporte
          </p>
        </CardContent>
      </Card>
    </AdminPage>
  );
}

