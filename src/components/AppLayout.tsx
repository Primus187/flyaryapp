import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import BottomNav from "./BottomNav";
import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useToast } from "@/hooks/use-toast";

export default function AppLayout() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [offline, setOffline] = useState(!navigator.onLine);
  const { pendingCount, syncing, syncAll } = useOfflineSync();

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  const handleManualSync = async () => {
    const synced = await syncAll();
    if (synced && synced > 0) {
      toast({ title: t("offline.syncComplete"), description: `${synced} ${t("offline.flightsSynced")}` });
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[hsl(210_20%_98%)] to-[hsl(199_30%_96%)] dark:from-[hsl(215_28%_8%)] dark:to-[hsl(215_25%_11%)]">
      {offline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive/90 text-destructive-foreground px-4 py-2 text-xs font-medium backdrop-blur-sm">
          <WifiOff className="h-3.5 w-3.5" />
          {t("offline.banner")}
          {pendingCount > 0 && (
            <span className="ml-1">({pendingCount} {t("offline.pendingFlights")})</span>
          )}
        </div>
      )}
      {!offline && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="sticky top-0 z-50 w-full flex items-center justify-center gap-2 bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-medium backdrop-blur-sm"
        >
          {syncing ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {syncing ? t("offline.syncing") : `${pendingCount} ${t("offline.pendingFlights")} — ${t("offline.tapToSync")}`}
        </button>
      )}
      <Outlet />
      <BottomNav />
    </div>
  );
}
