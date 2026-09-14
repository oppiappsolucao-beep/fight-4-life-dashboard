import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAcademyHostGuard } from "../../hooks/useAcademyHostGuard";
import { canAccessProfessor } from "../../lib/access";
import DashboardShell from "../DashboardShell";
import ProfessorSidebar from "./ProfessorSidebar";

export default function ProfessorLayout() {
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

  if (!isAuthenticated || !user || !canAccessProfessor(user.role)) {
    return <Navigate to="/professor/login" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4f6f8]">
      <DashboardShell
        title="Professor"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        sidebar={
          <ProfessorSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        }
      >
        <Outlet />
      </DashboardShell>
    </div>
  );
}
