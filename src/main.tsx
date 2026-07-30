import ReactDOM from "react-dom/client";
import "./index.css";
import AppRouter from "@/router";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AuthProvider>
      <AppRouter />
      <Toaster />
    </AuthProvider>
  </ErrorBoundary>
);
