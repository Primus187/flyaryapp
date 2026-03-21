import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-[hsl(210_20%_98%)] to-[hsl(199_30%_96%)] dark:from-[hsl(215_28%_8%)] dark:to-[hsl(215_25%_11%)]">
      <Outlet />
      <BottomNav />
    </div>
  );
}
