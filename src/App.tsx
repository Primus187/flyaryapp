import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleModeProvider } from "@/contexts/RoleModeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import { pathToKeepThroughLogin, rememberAfterLogin, takeAfterLogin } from "@/lib/after-login";
import { allowedWithoutAccess } from "@/lib/app-access";
import { useAppAccess } from "@/hooks/use-app-access";
import { Skeleton } from "@/components/ui/skeleton";
import { prefetchDashboard } from "@/hooks/use-dashboard-data";

// Eagerly loaded (critical path)
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";

// Lazy loaded
const feedImport = () => import("@/pages/Feed");
const Feed = lazy(feedImport);
const Stats = lazy(() => import("@/pages/Stats"));
const Flights = lazy(() => import("@/pages/Flights"));
const FlightForm = lazy(() => import("@/pages/FlightForm"));
const Market = lazy(() => import("@/pages/Market"));
const MarketMine = lazy(() => import("@/pages/MarketMine"));
const MarketListingDetail = lazy(() => import("@/pages/MarketListingDetail"));
const MarketModeration = lazy(() => import("@/pages/MarketModeration"));
const SharedListing = lazy(() => import("@/pages/SharedListing"));
const MarketListingForm = lazy(() => import("@/pages/MarketListingForm"));
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
const AdminErrors = lazy(() => import("@/pages/AdminErrors"));
const AdminAccess = lazy(() => import("@/pages/AdminAccess"));
const AdminSchools = lazy(() => import("@/pages/AdminSchools"));
const AdminFeedback = lazy(() => import("@/pages/AdminFeedback"));
const WaitingRoom = lazy(() => import("@/pages/WaitingRoom"));
const RedeemInvite = lazy(() => import("@/pages/RedeemInvite"));
const AdminSites = lazy(() => import("@/pages/AdminSites"));
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/AdminOverview"));
const AdminBackups = lazy(() => import("@/pages/AdminBackups"));
const LegalTerms = lazy(() => import("@/pages/LegalTerms"));
const LegalLicenses = lazy(() => import("@/pages/LegalLicenses"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const ChallengeDetail = lazy(() => import("@/pages/ChallengeDetail"));
const PilotProfile = lazy(() => import("@/pages/PilotProfile"));
const SearchPage = lazy(() => import("@/pages/Search"));
const SchoolDashboard = lazy(() => import("@/pages/SchoolDashboard"));
const StudentDossier = lazy(() => import("@/pages/StudentDossier"));
const NotificationsPage = lazy(() => import("@/pages/Notifications"));
const Messages = lazy(() => import("@/pages/Messages"));
const MessageChannel = lazy(() => import("@/pages/MessageChannel"));
const Weather = lazy(() => import("@/pages/Weather"));
const SharedFlightDetail = lazy(() => import("@/pages/SharedFlightDetail"));
const PassengerConfirm = lazy(() => import("@/pages/PassengerConfirm"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

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
  const location = useLocation();
  const access = useAppAccess();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">...</div>;
  if (!user) {
    // Shared .igc files and invite links bring the pilot back to them after signing in.
    const keep = pathToKeepThroughLogin(location.pathname, location.search);
    if (keep) rememberAfterLogin(keep);
    return <Navigate to="/auth" replace />;
  }
  // coming from a public listing (plan 8.4): go on to the listing instead of the dashboard
  const afterLogin = takeAfterLogin();
  if (afterLogin) return <Navigate to={afterLogin} replace />;
  // Pilot phase (migration 0079): accounts without an invitation wait. If the check fails, let them in
  // (the gate is a product gate; the database enforces what matters).
  if (!allowedWithoutAccess(location.pathname)) {
    if (access.isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">...</div>;
    if (access.data && !access.data.has_access) return <WaitingRoom access={access.data} />;
  }
  return <>{children}</>;
}

// Legal pages are public (sign-in page and Google consent screen link to them): signed-in pilots
// keep the app navigation, visitors see the page on its own.
function OptionalAppLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <AppLayout /> : <Outlet />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();
  const [showSplash, setShowSplash] = useState(() => sessionStorage.getItem("flyary-splash-seen") !== "1");
  const [progress, setProgress] = useState(5);
  const [dataReady, setDataReady] = useState(false);

  // Bump progress when auth resolves
  useEffect(() => {
    if (!authLoading) setProgress(p => Math.max(p, 20));
  }, [authLoading]);

  // Start the dashboard fetch as early as possible, but never keep the splash up for it:
  // the dashboard renders its own skeleton. Waiting here added the full request chain
  // (several round trips to the database) to every cold start.
  useEffect(() => {
    if (authLoading) return;
    if (showSplash && user && pathname === "/") void prefetchDashboard(user.id, queryClient).catch(() => {});
    setProgress(100);
    setDataReady(true);
  }, [user, authLoading, pathname, showSplash]);

  const handleSplashFinished = useCallback(() => {
    sessionStorage.setItem("flyary-splash-seen", "1");
    setShowSplash(false);
  }, []);

  return (
    <>
      {showSplash && (
        <SplashScreen
          onFinished={handleSplashFinished}
          progress={progress}
          ready={dataReady}
        />
      )}
      {children}
    </>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <RoleModeProvider>
              <SplashGate>
                <PageErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                    {/* Google-only sign-in (2026-09-28): old password-reset links lead to the sign-in page. */}
                    <Route path="/reset-password" element={<Navigate to="/auth" replace />} />
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
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminOverview />} />
                        <Route path="errors" element={<AdminErrors />} />
                        <Route path="access" element={<AdminAccess />} />
                        {/* pushes and bookmarks from before migration 0084 */}
                        <Route path="waitlist" element={<Navigate to="/admin/access" replace />} />
                        <Route path="schools" element={<AdminSchools />} />
                        <Route path="feedback" element={<AdminFeedback />} />
                        <Route path="backups" element={<AdminBackups />} />
                        <Route path="sites" element={<AdminSites />} />
                      </Route>
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/challenges/:id" element={<ChallengeDetail />} />
                      <Route path="/pilot/:userId" element={<PilotProfile />} />
                      <Route path="/school" element={<SchoolDashboard />} />
                      <Route path="/school/:section" element={<SchoolDashboard />} />
                      <Route path="/school/students/:groupId/:studentId" element={<StudentDossier />} />
                      <Route path="/weather" element={<Weather />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/messages/:channelId" element={<MessageChannel />} />
                      <Route path="/market" element={<Market />} />
                      <Route path="/market/mine" element={<MarketMine />} />
                      <Route path="/market/new" element={<MarketListingForm />} />
                      <Route path="/market/moderation" element={<MarketModeration />} />
                      <Route path="/market/:id" element={<MarketListingDetail />} />
                      <Route path="/market/:id/edit" element={<MarketListingForm />} />
                    </Route>
                    <Route element={<OptionalAppLayout />}>
                      <Route path="/legal" element={<Legal />} />
                      <Route path="/legal/terms" element={<LegalTerms />} />
                      <Route path="/legal/licenses" element={<LegalLicenses />} />
                    </Route>
                    <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                    <Route path="/welcome/:token" element={<ProtectedRoute><RedeemInvite /></ProtectedRoute>} />
                    <Route path="/welcome/lead/:token" element={<ProtectedRoute><RedeemInvite kind="lead" /></ProtectedRoute>} />
                    <Route path="/shared/flights/:token" element={<SharedFlightDetail />} />
                    {/* Tandem passenger confirms through a single-use link, no account needed (migration 0076) */}
                    <Route path="/passenger/:token" element={<PassengerConfirm />} />
                    <Route path="/shared/market/:token" element={<SharedListing />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </PageErrorBoundary>
              </SplashGate>
              </RoleModeProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
