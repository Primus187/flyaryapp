import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BottomNav from "./BottomNav";
import { WifiOff } from "lucide-react";

export default function AppLayout() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-[hsl(210_20%_98%)] to-[hsl(199_30%_96%)] dark:from-[hsl(215_28%_8%)] dark:to-[hsl(215_25%_11%)]">
      {offline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive/90 text-destructive-foreground px-4 py-2 text-xs font-medium backdrop-blur-sm">
          <WifiOff className="h-3.5 w-3.5" />
          {t("offline.banner")}
        </div>
      )}
      <Outlet />
      <BottomNav />
    </div>
  );
}
