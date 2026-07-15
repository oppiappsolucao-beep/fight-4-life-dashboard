import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessDev } from "../../lib/access";
import DevSidebar from "./DevSidebar";

const GYM_BG = "/hero-gym.png?v=2";

export default function DevLayout() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-white/50">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated || !user || !canAccessDev(user.role)) {
    return <Navigate to="/dev/login" replace />;
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
        <DevSidebar />
        <main className="min-h-screen flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
