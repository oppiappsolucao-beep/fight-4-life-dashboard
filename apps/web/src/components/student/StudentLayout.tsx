import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import DashboardShell from "../DashboardShell";
import StudentSidebar from "./StudentSidebar";
import { hasStudentSession } from "../../lib/studentSession";

const GYM_BG = "/hero-gym.png?v=2";

export default function StudentLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!hasStudentSession()) {
    return <Navigate to="/" replace />;
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
        title="Aluno"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        sidebar={
          <StudentSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        }
      >
        <Outlet />
      </DashboardShell>
    </div>
  );
}
