import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import Register from "@/pages/Register";
import ProtectedRoute from "@/router/ProtectedRoute";
import Logout from "@/pages/Logout";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardHome from "@/pages/dashboard/DashboardHome";
import EventsPage from "@/pages/dashboard/EventsPage";
import EventsManagementPage from "@/pages/dashboard/EventsManagementPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import ScoringTemplatesPage from "@/pages/dashboard/ScoringTemplatesPage";
import EventAdminLayout from "@/components/layout/EventAdminLayout";
import ParticipantsPage from "@/pages/event/ParticipantsPage";
import RacesPage from "@/pages/event/RacesPage";
import TimingPage from "@/pages/event/TimingPage";
import EventOverviewPage from "@/pages/event/EventOverviewPage";
import ParticipantDetail from "@/pages/event/ParticipantDetail";
import CrewList from "@/pages/crews/CrewList";
import CrewDetail from "@/pages/crews/CrewDetail";
import CrewWizardPage from "@/pages/crews/CrewWizardPage";
import DistancesPage from "@/pages/event/DistancesPage";
import EventPermissionsPage from "@/pages/event/EventPermissionsPage";
import TimingPointsPage from "@/pages/event/TimingPointsPage";
import NotificationsPage from "@/pages/event/NotificationsPage";
import RacePhasesPage from "@/pages/races/RacePhasesPage";
import TimingOverviewPage from "@/pages/timing/TimingOverviewPage";
import RacePhaseDetailPage from "@/pages/races/RacePhaseDetailPage";
import GenerateRacesPage from "@/pages/races/GenerateRacesPage";
import ArbitresPage from "@/pages/event/ArbitresPage";
import IndoorPage from "@/pages/event/IndoorPage";
import IndoorRaceDetailPage from "@/pages/event/IndoorRaceDetailPage";
import EventsList from "@/pages/public/EventsList";
import PublicEvent from "@/pages/public/PublicEvent";
import Live from "@/pages/public/Live";
import Startlist from "@/pages/public/Startlist";
import Results from "@/pages/public/Results";
import Informations from "@/pages/public/Informations";
import HomePage from "@/pages/HomePage";
import AdminLogin from "@/pages/AdminLogin";
import AdminRedirect from "@/pages/AdminRedirect";
import WebSocketTestPage from "@/pages/websocket/WebSocketTestPage";

const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/register", element: <Register /> },
  { path: "/logout", element: <Logout /> },
  
  // Routes admin
  { path: "/admin", element: <AdminRedirect /> },
  { path: "/admin/login", element: <AdminLogin /> },

  // Route publique pour compatibilité (redirige vers l'accueil)
  {
    path: "/public/events",
    element: <Navigate to="/" replace />,
  },

  {
    path: "/public/event/:eventId",
    element: <PublicEvent />,
    children: [
      { path: "", element: <Navigate to="live" replace /> },
      { path: "live", element: <Live /> },
      { path: "startlist", element: <Startlist /> },
      { path: "results", element: <Results /> },
      { path: "informations", element: <Informations /> },
    ],
  },

  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "", element: <DashboardHome /> },
      { path: "events", element: <EventsPage /> },
      { path: "events-management", element: <EventsManagementPage /> },
      { path: "scoring-templates", element: <ScoringTemplatesPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "websocket-test", element: <WebSocketTestPage /> },
    ],
  },

  {
    path: "/event/:eventId",
    element: (
      <ProtectedRoute>
        <EventAdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: "", element: <EventOverviewPage /> },
      { path: "participants", element: <ParticipantsPage /> },
      { path: "participants/:participantId", element: <ParticipantDetail /> },
      { path: "crews", element: <CrewList /> },
      { path: "crews/new", element: <CrewWizardPage /> },
      { path: "crews/:crewId", element: <CrewDetail /> },
      { path: "races", element: <RacesPage /> },
      { path: "timing", element: <TimingOverviewPage /> },
      { path: "timing/:timingPointId", element: <TimingPage /> },
      { path: "distances", element: <DistancesPage /> }, // ✅ route ajoutée ici
      { path: "permissions", element: <EventPermissionsPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "racePhases", element: <RacePhasesPage /> },
      { path: "racePhases/:phaseId", element: <RacePhaseDetailPage /> },
      { path: "generate-races", element: <GenerateRacesPage /> },
      { path: "timingPoint", element: <TimingPointsPage /> },
      { path: "arbitres", element: <ArbitresPage /> },
      { path: "indoor", element: <IndoorPage /> },
      { path: "indoor/:raceId", element: <IndoorRaceDetailPage /> },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
