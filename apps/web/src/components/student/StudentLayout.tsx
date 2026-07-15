import { Navigate, Outlet } from "react-router-dom";
import StudentSidebar from "./StudentSidebar";

const GYM_BG = "/hero-gym.png?v=2";

function hasStudentSession(): boolean {
  return Boolean(sessionStorage.getItem("studentIdentifier"));
}

export default function StudentLayout() {
  if (!hasStudentSession()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${GYM_BG})` }}
      />
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/40 to-black/55" />

      <div className="relative z-10 flex min-h-screen items-stretch">
        <StudentSidebar />
        <main className="min-h-screen flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
