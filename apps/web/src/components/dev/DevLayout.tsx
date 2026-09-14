import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessDev } from "../../lib/access";
import DashboardShell from "../DashboardShell";
import DevSidebar from "./DevSidebar";

export default function DevLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated || !user || !canAccessDev(user.role)) {
    return <Navigate to="/dev/login" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#eef2f6]">
      <DashboardShell
        title="Desenvolvimento"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        sidebar={
          <DevSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        }
      >
        <Outlet />
      </DashboardShell>
    </div>
  );
}
