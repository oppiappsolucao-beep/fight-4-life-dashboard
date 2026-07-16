import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessDev, canAccessOwner } from "../../lib/access";
import DashboardShell from "../DashboardShell";
import OwnerSidebar from "./OwnerSidebar";

const GYM_BG = "/hero-gym.png?v=3";

export default function OwnerLayout() {
  const { isAuthenticated, loading, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-white/50">
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
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${GYM_BG})` }}
      />
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/40 to-black/55" />

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
