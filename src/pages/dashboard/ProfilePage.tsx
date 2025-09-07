import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Votre profil 👤</h2>
      <div className="space-y-2">
        <p><strong>Nom :</strong> {user?.name}</p>
        <p><strong>Email :</strong> {user?.email}</p>
        <p><strong>Licence :</strong> {user?.num_license || "N/A"}</p>
        <p><strong>Rôle :</strong> {user?.role}</p>
      </div>
    </div>
  );
}
