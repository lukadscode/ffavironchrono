import ReactDOM from "react-dom/client";
import "./index.css";
import AppRouter from "@/router";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";

// ⚠️ Note:
// React.StrictMode can cause some third-party UI libraries (portals, dialogs, tooltips, etc.)
// to run their mount/unmount logic twice in development, which may trigger DOM errors like
// "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
// To avoid these runtime errors in this app, we render without StrictMode for now.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <AppRouter />
    <Toaster />
  </AuthProvider>
);
