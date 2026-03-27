import { useState, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly loaded (critical path)
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";

// Lazy loaded
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Feed = lazy(() => import("@/pages/Feed"));
const Stats = lazy(() => import("@/pages/Stats"));
const Flights = lazy(() => import("@/pages/Flights"));
const FlightForm = lazy(() => import("@/pages/FlightForm"));
const FlightDetail = lazy(() => import("@/pages/FlightDetail"));
const MapView = lazy(() => import("@/pages/MapView"));
const Locations = lazy(() => import("@/pages/Locations"));
const LocationDetail = lazy(() => import("@/pages/LocationDetail"));
const Events = lazy(() => import("@/pages/Events"));
const EventDetail = lazy(() => import("@/pages/EventDetail"));
const EventForm = lazy(() => import("@/pages/EventForm"));
const Groups = lazy(() => import("@/pages/Groups"));
const GroupDetail = lazy(() => import("@/pages/GroupDetail"));
const Profile = lazy(() => import("@/pages/Profile"));
const More = lazy(() => import("@/pages/More"));
const Settings = lazy(() => import("@/pages/Settings"));
const ImportFlights = lazy(() => import("@/pages/ImportFlights"));
const ImportLocations = lazy(() => import("@/pages/ImportLocations"));
const Training = lazy(() => import("@/pages/Training"));
const TrainingItemDetail = lazy(() => import("@/pages/TrainingItemDetail"));
const Legal = lazy(() => import("@/pages/Legal"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const ChallengeDetail = lazy(() => import("@/pages/ChallengeDetail"));
const PilotProfile = lazy(() => import("@/pages/PilotProfile"));
const SearchPage = lazy(() => import("@/pages/Search"));
const SchoolDashboard = lazy(() => import("@/pages/SchoolDashboard"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinished = useCallback(() => setShowSplash(false), []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onFinished={handleSplashFinished} />}
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/feed" element={<Feed />} />
                    <Route path="/flights" element={<Flights />} />
                    <Route path="/flights/new" element={<FlightForm />} />
                    <Route path="/flights/:id" element={<FlightDetail />} />
                    <Route path="/flights/:id/edit" element={<FlightForm />} />
                    <Route path="/locations" element={<Locations />} />
                    <Route path="/locations/:id" element={<LocationDetail />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/events/new" element={<EventForm />} />
                    <Route path="/events/:id" element={<EventDetail />} />
                    <Route path="/events/:id/edit" element={<EventForm />} />
                    <Route path="/groups" element={<Groups />} />
                    <Route path="/groups/:id" element={<GroupDetail />} />
                    <Route path="/training" element={<Training />} />
                    <Route path="/training/:itemId" element={<TrainingItemDetail />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/more" element={<More />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/import" element={<ImportFlights />} />
                    <Route path="/import-locations" element={<ImportLocations />} />
                    <Route path="/legal" element={<Legal />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/challenges/:id" element={<ChallengeDetail />} />
                    <Route path="/pilot/:userId" element={<PilotProfile />} />
                    <Route path="/school" element={<SchoolDashboard />} />
                  </Route>
                  <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
