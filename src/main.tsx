import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AppRouter from "@/router";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRouter />
      <Toaster />
    </AuthProvider>
  </React.StrictMode>
);
