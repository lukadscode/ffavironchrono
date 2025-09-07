import { createContext, useContext, useState, useEffect } from "react";
import { fetchUserProfile } from "@/api/auth";
import api from "@/lib/axios";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<any>(null);
  const [loading, setLoading] = useState(true); // 🕐 important pour éviter les flash de logout

    const login = async (tokenData: any) => {
      const cleanTokens = tokenData?.data;

      console.log("🟢 login() - stockage des tokens :", cleanTokens);
      localStorage.setItem("authTokens", JSON.stringify(cleanTokens));
      setTokens(cleanTokens); // cela déclenchera l'appel à fetchUserProfile dans useEffect
    };

  const logout = () => {
    console.log("🚪 logout() - déconnexion");
    setUser(null);
    setTokens(null);
    localStorage.removeItem("authTokens");
    delete api.defaults.headers.common.Authorization;
  };

  // 🔐 Mise à jour d'Axios quand tokens changent
  useEffect(() => {
    if (tokens?.access_token) {
      api.defaults.headers.common.Authorization = `Bearer ${tokens.access_token}`;
      console.log("📦 Axios config mis à jour avec token :", tokens.access_token);

      fetchUserProfile()
        .then((res) => {
          console.log("✅ Profil utilisateur chargé :", res?.data);
          // Combine user et events ensemble
          setUser({
            ...res.data.user,
            events: res.data.events,
          });
          setLoading(false);
        })
        .catch((err) => {
          console.error("❌ Erreur profil utilisateur :", err);
          logout();
          setLoading(false); // ❗️ il faut le garder aussi ici
        });
    } else {
      setLoading(false);
    }
  }, [tokens]);

  // 🔁 Auto-login au montage
  useEffect(() => {
    const saved = localStorage.getItem("authTokens");

    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("🔁 Auto-login - token trouvé :", parsed);
      setTokens(parsed); // déclenche useEffect ci-dessus
    } else {
      console.log("ℹ️ Aucun token trouvé au démarrage");
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
