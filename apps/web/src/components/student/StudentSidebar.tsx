import { NavLink, useNavigate } from "react-router-dom";
import OppiLogo from "../OppiLogo";
import { sidebarShellClass } from "../DashboardShell";
import { clearStudentSession, getStudentSession } from "../../lib/studentSession";

const MENU_ITEMS = [
  { to: "/inicio", label: "Visão Geral", icon: HomeIcon },
  { to: "/treino", label: "Treino", icon: DumbbellIcon },
  { to: "/galeria", label: "Galeria", icon: VideoIcon },
  { to: "/pagamentos", label: "Pagamentos", icon: PaymentIcon },
  { to: "/frequencia", label: "Frequência", icon: CalendarIcon },
  { to: "/atendimento", label: "Atendimento", icon: SupportIcon },
  { to: "/dietas", label: "Dietas", icon: DietIcon },
  { to: "/termo-saude", label: "Termo de Saúde", icon: HealthIcon },
  { to: "/perfil", label: "Perfil", icon: UserIcon },
];

interface StudentSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function StudentSidebar({ open, onClose }: StudentSidebarProps) {
  const navigate = useNavigate();
  const session = getStudentSession();
  const displayName = session?.nomeCompleto ?? session?.identifier;

  function handleLogout() {
    clearStudentSession();
    onClose();
    navigate("/");
  }

  return (
    <aside className={sidebarShellClass(open)}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="min-w-0">
          <OppiLogo size="sm" />
          <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-white/50">
            Área do aluno
          </p>
          {displayName && (
            <p className="mt-1 truncate text-sm font-medium text-white/90">
              {displayName}
            </p>
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

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10v4M7 8v8M17 8v8M20 10v4M7 12h10" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3c-4 0-7 2.5-7 6v4l-2 2h18l-2-2V9c0-3.5-3-6-7-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function DietIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v18M8 7h8M7 12h10M8 17h8" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 8v8M8 12h8" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-4 13.5-4 14 0" />
    </svg>
  );
}
