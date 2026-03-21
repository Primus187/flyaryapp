import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Plus, Map, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/flights", icon: BookOpen, label: "Flugbuch" },
  { path: "/flights/new", icon: Plus, label: "Neu", isAction: true },
  { path: "/map", icon: Map, label: "Karte" },
  { path: "/profile", icon: User, label: "Profil" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-sm safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = tab.path === "/" 
            ? location.pathname === "/" 
            : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
              >
                <Icon className="h-6 w-6" />
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
