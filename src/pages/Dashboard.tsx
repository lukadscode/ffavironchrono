import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Bienvenue {user?.name || "utilisateur"} !</h1>
      <Button onClick={logout}>Déconnexion</Button>
    </div>
  );
}
