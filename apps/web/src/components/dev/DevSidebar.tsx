import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import OppiLogo from "../OppiLogo";
import { sidebarShellClass } from "../DashboardShell";

const MENU_ITEMS = [
  { to: "/dev/visao-geral", label: "Visão Geral", icon: HomeIcon },
  { to: "/dev/cadastro-academias", label: "Cadastro de Academias", icon: BuildingIcon },
  { to: "/dev/modalidades", label: "Modalidades", icon: ModalityIcon },
  { to: "/dev/donos-academias", label: "Donos de Academias", icon: OwnersIcon },
  { to: "/dev/contas-a-receber", label: "Contas a Receber", icon: ReceivableIcon },
];

interface DevSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function DevSidebar({ open, onClose }: DevSidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    onClose();
    navigate("/dev/login");
  }

  return (
    <aside className={sidebarShellClass(open)}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <OppiLogo size="sm" />
          <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
            Desenvolvimento
          </p>
          {user?.name && (
            <p className="mt-1 truncate text-sm font-medium text-white/90">{user.name}</p>
          )}
          {user?.email && (
            <p className="mt-0.5 truncate text-xs text-white/50">{user.email}</p>
          )}
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
            <span className="min-w-0 break-words">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-4">
        <NavLink
          to="/"
          onClick={onClose}
          className="block w-full rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-medium text-white/60 transition hover:border-[#e85d6f]/40 hover:text-white"
        >
          Área do aluno
        </NavLink>
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

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V6l8-4 8 4v14H4Z" />
      <path d="M9 20v-6h6v6M9 10h.01M15 10h.01" />
    </svg>
  );
}

function ModalityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function OwnersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c1-4 5-6 12-6M16 8a3 3 0 1 1 0 6M21 20c0-3.5-2.5-5.5-5-6.5" />
    </svg>
  );
}

function ReceivableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M7 15h3" />
    </svg>
  );
}
