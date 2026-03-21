import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(180deg, hsl(210 20% 98%) 0%, hsl(199 30% 96%) 100%)" }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
