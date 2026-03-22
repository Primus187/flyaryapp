import { useState, useCallback } from "react";
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
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Stats from "@/pages/Stats";
import Flights from "@/pages/Flights";
import FlightForm from "@/pages/FlightForm";
import FlightDetail from "@/pages/FlightDetail";

import MapView from "@/pages/MapView";
import Locations from "@/pages/Locations";
import LocationDetail from "@/pages/LocationDetail";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import EventForm from "@/pages/EventForm";
import Groups from "@/pages/Groups";
import GroupDetail from "@/pages/GroupDetail";
import Profile from "@/pages/Profile";
import More from "@/pages/More";
import Settings from "@/pages/Settings";
import ImportFlights from "@/pages/ImportFlights";
import ImportLocations from "@/pages/ImportLocations";
import Training from "@/pages/Training";
import TrainingItemDetail from "@/pages/TrainingItemDetail";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

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
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
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
                  <Route path="/import" element={<ImportFlights />} />
                  <Route path="/import-locations" element={<ImportLocations />} />
                </Route>
                <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
