import { createContext, useContext, useState, useEffect } from "react";
import { fetchUserProfile } from "@/api/auth";
import api from "@/lib/axios";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const login = async (tokenData: any) => {
    const cleanTokens = tokenData?.data;
    localStorage.setItem("authTokens", JSON.stringify(cleanTokens));
    setTokens(cleanTokens);
  };

  const logout = () => {
    setUser(null);
    setTokens(null);
    localStorage.removeItem("authTokens");
    delete api.defaults.headers.common.Authorization;
  };

  useEffect(() => {
    if (tokens?.access_token) {
      api.defaults.headers.common.Authorization = `Bearer ${tokens.access_token}`;

      fetchUserProfile()
        .then((res) => {
          setUser({
            ...res.data.user,
            events: res.data.events,
          });
          setLoading(false);
        })
        .catch(() => {
          logout();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    const saved = localStorage.getItem("authTokens");

    if (saved) {
      const parsed = JSON.parse(saved);
      setTokens(parsed);
    } else {
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
