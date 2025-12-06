import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import Register from "@/pages/Register";
import ProtectedRoute from "@/router/ProtectedRoute";
import EventProtectedRoute from "@/router/EventProtectedRoute";
import Logout from "@/pages/Logout";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardHome from "@/pages/dashboard/DashboardHome";
import EventsPage from "@/pages/dashboard/EventsPage";
import EventsManagementPage from "@/pages/dashboard/EventsManagementPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import ScoringTemplatesPage from "@/pages/dashboard/ScoringTemplatesPage";
import UsersManagementPage from "@/pages/dashboard/UsersManagementPage";
import UserDetailPage from "@/pages/dashboard/UserDetailPage";
import CategoriesManagementPage from "@/pages/dashboard/CategoriesManagementPage";
import ClubsManagementPage from "@/pages/dashboard/ClubsManagementPage";
import EventAdminLayout from "@/components/layout/EventAdminLayout";
import ParticipantsPage from "@/pages/event/ParticipantsPage";
import RacesPage from "@/pages/event/RacesPage";
import TimingPage from "@/pages/event/TimingPage";
import EventOverviewPage from "@/pages/event/EventOverviewPage";
import ParticipantDetail from "@/pages/event/ParticipantDetail";
import CrewList from "@/pages/crews/CrewList";
import CrewDetail from "@/pages/crews/CrewDetail";
import CrewWizardPage from "@/pages/crews/CrewWizardPage";
import CrewStatusManagementPage from "@/pages/event/CrewStatusManagementPage";
import DistancesPage from "@/pages/event/DistancesPage";
import EventPermissionsPage from "@/pages/event/EventPermissionsPage";
import TimingPointsPage from "@/pages/event/TimingPointsPage";
import NotificationsPage from "@/pages/event/NotificationsPage";
import RacePhasesPage from "@/pages/races/RacePhasesPage";
import TimingOverviewPage from "@/pages/timing/TimingOverviewPage";
import RacePhaseDetailPage from "@/pages/races/RacePhaseDetailPage";
import GenerateRacesPage from "@/pages/races/GenerateRacesPage";
import CategoriesPage from "@/pages/races/CategoriesPage";
import ArbitresPage from "@/pages/event/ArbitresPage";
import IndoorPage from "@/pages/event/IndoorPage";
import IndoorRaceDetailPage from "@/pages/event/IndoorRaceDetailPage";
import ImportErgRaceRacePage from "@/pages/event/ImportErgRaceRacePage";
import ExportPage from "@/pages/event/ExportPage";
import EventUpdatePage from "@/pages/event/EventUpdatePage";
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
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ForgotPassword from "@/pages/ForgotPassword";

const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/register", element: <Register /> },
  { path: "/logout", element: <Logout /> },
  
  // Routes admin
  { path: "/admin", element: <AdminRedirect /> },
  { path: "/admin/login", element: <AdminLogin /> },
  
  // Routes de vérification et réinitialisation
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/forgot-password", element: <ForgotPassword /> },

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
      { path: "categories-management", element: <CategoriesManagementPage /> },
      { path: "clubs-management", element: <ClubsManagementPage /> },
      { path: "scoring-templates", element: <ScoringTemplatesPage /> },
      { path: "users-management", element: <UsersManagementPage /> },
      { path: "users-management/:userId", element: <UserDetailPage /> },
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
      // Overview - accessible à tous les rôles
      { 
        path: "", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor", "referee", "timing", "viewer"]}>
            <EventOverviewPage />
          </EventProtectedRoute>
        )
      },
      // Participants - organisateur et éditeur
      { 
        path: "participants", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <ParticipantsPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "participants/:participantId", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <ParticipantDetail />
          </EventProtectedRoute>
        )
      },
      // Équipages - organisateur et éditeur
      { 
        path: "crews", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <CrewList />
          </EventProtectedRoute>
        )
      },
      { 
        path: "crews/new", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <CrewWizardPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "crews/:crewId", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <CrewDetail />
          </EventProtectedRoute>
        )
      },
      { 
        path: "crew-status", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <CrewStatusManagementPage />
          </EventProtectedRoute>
        )
      },
      // Courses - organisateur et éditeur
      { 
        path: "races", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <RacesPage />
          </EventProtectedRoute>
        )
      },
      // Timing - organisateur et chronométreur
      { 
        path: "timing", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "timing"]}>
            <TimingOverviewPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "timing/:timingPointId", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "timing"]}>
            <TimingPage />
          </EventProtectedRoute>
        )
      },
      // Distances - organisateur et éditeur
      { 
        path: "distances", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <DistancesPage />
          </EventProtectedRoute>
        )
      },
      // Permissions - organisateur uniquement
      { 
        path: "permissions", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser"]}>
            <EventPermissionsPage />
          </EventProtectedRoute>
        )
      },
      // Notifications - organisateur uniquement
      { 
        path: "notifications", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser"]}>
            <NotificationsPage />
          </EventProtectedRoute>
        )
      },
      // Catégories - organisateur et éditeur
      { 
        path: "categories", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <CategoriesPage />
          </EventProtectedRoute>
        )
      },
      // Phases de course - organisateur et éditeur
      { 
        path: "racePhases", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <RacePhasesPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "racePhases/:phaseId", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <RacePhaseDetailPage />
          </EventProtectedRoute>
        )
      },
      // Génération de courses - organisateur et éditeur
      { 
        path: "generate-races", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <GenerateRacesPage />
          </EventProtectedRoute>
        )
      },
      // Points de chronométrage - organisateur et chronométreur
      { 
        path: "timingPoint", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "timing"]}>
            <TimingPointsPage />
          </EventProtectedRoute>
        )
      },
      // Arbitres - organisateur et arbitre
      { 
        path: "arbitres", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "referee"]}>
            <ArbitresPage />
          </EventProtectedRoute>
        )
      },
      // Indoor - organisateur et chronométreur
      { 
        path: "indoor", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "timing"]}>
            <IndoorPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "indoor/:raceId", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "timing"]}>
            <IndoorRaceDetailPage />
          </EventProtectedRoute>
        )
      },
      { 
        path: "indoor/import-ergrace", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser"]}>
            <ImportErgRaceRacePage />
          </EventProtectedRoute>
        )
      },
      // Exports - organisateur et éditeur
      { 
        path: "export", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser", "editor"]}>
            <ExportPage />
          </EventProtectedRoute>
        )
      },
      // Mise à jour depuis FFAviron - organisateur uniquement
      { 
        path: "update", 
        element: (
          <EventProtectedRoute allowedRoles={["organiser"]}>
            <EventUpdatePage />
          </EventProtectedRoute>
        )
      },
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
