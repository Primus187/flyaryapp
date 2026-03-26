import { useLocation, useNavigate } from "react-router-dom";
import { Home, Compass, BookOpen, MapPin, Calendar, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: "/", icon: Home },
    { path: "/feed", icon: Compass },
    { path: "/flights", icon: BookOpen },
    { path: "/events", icon: Calendar },
    { path: "/locations", icon: MapPin },
    { path: "/more", icon: LayoutGrid },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-card/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-12 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(tab.path);
          const Icon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.2 : 1.5} />
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
