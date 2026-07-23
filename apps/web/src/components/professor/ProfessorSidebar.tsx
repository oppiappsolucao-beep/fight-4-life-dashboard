import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import OppiLogo from "../OppiLogo";
import { sidebarShellClass } from "../DashboardShell";

const MENU_ITEMS = [
  { to: "/professor/cadastro-treino", label: "Cadastro de Treino", icon: DumbbellIcon },
  { to: "/professor/presenca", label: "Presença", icon: CheckIcon },
];

interface ProfessorSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfessorSidebar({ open, onClose }: ProfessorSidebarProps) {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();

  function handleLogout() {
    logout();
    onClose();
    navigate("/professor/login");
  }

  return (
    <aside className={sidebarShellClass(open)}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <OppiLogo size="sm" />
          <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
            Professor
          </p>
          {tenant?.name ? (
            <p className="mt-1 truncate text-sm font-medium text-white/90">{tenant.name}</p>
          ) : null}
          {user?.name ? <p className="mt-0.5 truncate text-xs text-white/50">{user.name}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 md:hidden"
        >
          ×
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MENU_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#e85d6f]/20 text-[#e85d6f]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/70 transition hover:border-[#e85d6f]/40 hover:text-[#e85d6f]"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

function DumbbellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9v6M18 9v6M9 12h6" />
      <rect x="3" y="8" width="3" height="8" rx="1" />
      <rect x="18" y="8" width="3" height="8" rx="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
