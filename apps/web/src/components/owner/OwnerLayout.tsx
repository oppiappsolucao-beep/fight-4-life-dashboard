import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAcademyHostGuard } from "../../hooks/useAcademyHostGuard";
import { canAccessDev, canAccessOwner } from "../../lib/access";
import DashboardShell from "../DashboardShell";
import OwnerSidebar from "./OwnerSidebar";

export default function OwnerLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  useAcademyHostGuard();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/dono/login" replace />;
  }

  if (canAccessDev(user.role)) {
    return <Navigate to="/dev/cadastro-academias" replace />;
  }

  if (!canAccessOwner(user.role)) {
    return <Navigate to="/dono/login" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4f6f8]">
      <DashboardShell
        title="Dono"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        sidebar={
          <OwnerSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        }
      >
        <Outlet />
      </DashboardShell>
    </div>
  );
}
