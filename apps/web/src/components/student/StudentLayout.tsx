import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import DashboardShell from "../DashboardShell";
import StudentBillingGate from "./StudentBillingGate";
import StudentSidebar from "./StudentSidebar";
import { hasStudentSession } from "../../lib/studentSession";

export default function StudentLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!hasStudentSession()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#eef2f6]">
      <DashboardShell
        title="Aluno"
        menuOpen={menuOpen}
        onOpenMenu={() => setMenuOpen(true)}
        onCloseMenu={() => setMenuOpen(false)}
        sidebar={
          <StudentSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        }
      >
        <StudentBillingGate>
          <Outlet />
        </StudentBillingGate>
      </DashboardShell>
    </div>
  );
}