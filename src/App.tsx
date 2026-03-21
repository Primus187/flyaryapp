import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
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
import Profile from "@/pages/Profile";
import ImportFlights from "@/pages/ImportFlights";
import ImportLocations from "@/pages/ImportLocations";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Laden...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
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
              <Route path="/profile" element={<Profile />} />
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
);

export default App;
