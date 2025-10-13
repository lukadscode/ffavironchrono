import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProtectedRoute from "@/router/ProtectedRoute";
import Logout from "@/pages/Logout";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardHome from "@/pages/dashboard/DashboardHome";
import EventsPage from "@/pages/dashboard/EventsPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import EventAdminLayout from "@/components/layout/EventAdminLayout";
import ParticipantsPage from "@/pages/event/ParticipantsPage";
import RacesPage from "@/pages/event/RacesPage";
import TimingPage from "@/pages/event/TimingPage";
import EventOverviewPage from "@/pages/event/EventOverviewPage";
import ParticipantDetail from "@/pages/event/ParticipantDetail";
import CrewList from "@/pages/crews/CrewList";
import CrewDetail from "@/pages/crews/CrewDetail";
import DistancesPage from "@/pages/event/DistancesPage";
import EventPermissionsPage from "@/pages/event/EventPermissionsPage";
import TimingPointsPage from "@/pages/event/TimingPointsPage";
import RacePhasesPage from "@/pages/races/RacePhasesPage";
import TimingOverviewPage from "@/pages/timing/TimingOverviewPage";
import RacePhaseDetailPage from "@/pages/races/RacePhaseDetailPage";
import EventsList from "@/pages/public/EventsList";
import PublicEvent from "@/pages/public/PublicEvent";
import Live from "@/pages/public/Live";
import Startlist from "@/pages/public/Startlist";
import Results from "@/pages/public/Results";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/public/events" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/logout", element: <Logout /> },

  {
    path: "/public/events",
    element: <EventsList />,
  },

  {
    path: "/public/event/:eventId",
    element: <PublicEvent />,
    children: [
      { path: "", element: <Navigate to="live" replace /> },
      { path: "live", element: <Live /> },
      { path: "startlist", element: <Startlist /> },
      { path: "results", element: <Results /> },
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
      { path: "profile", element: <ProfilePage /> },
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
      { path: "crews/:crewId", element: <CrewDetail /> },
      { path: "races", element: <RacesPage /> },
      { path: "timing", element: <TimingOverviewPage /> },
      { path: "timing/:timingPointId", element: <TimingPage /> },
      { path: "distances", element: <DistancesPage /> }, // ✅ route ajoutée ici
      { path: "permissions", element: <EventPermissionsPage /> },
      { path: "racePhases", element: <RacePhasesPage /> },
      { path: "timingPoint", element: <TimingPointsPage /> },
      { path: "racePhases/:phaseId", element: <RacePhaseDetailPage /> },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
