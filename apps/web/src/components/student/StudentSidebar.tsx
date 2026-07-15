import { NavLink, useNavigate, Link } from "react-router-dom";
import OppiLogo from "../OppiLogo";

const MENU_ITEMS = [
  { to: "/treino", label: "Treino", icon: DumbbellIcon },
  { to: "/pagamentos", label: "Pagamentos", icon: PaymentIcon },
  { to: "/frequencia", label: "Frequência", icon: CalendarIcon },
  { to: "/atendimento", label: "Atendimento", icon: SupportIcon },
  { to: "/dietas", label: "Dietas", icon: DietIcon },
  { to: "/termo-saude", label: "Termo de Saúde", icon: HealthIcon },
  { to: "/perfil", label: "Perfil", icon: UserIcon },
];

export default function StudentSidebar() {
  const navigate = useNavigate();
  const identifier = sessionStorage.getItem("studentIdentifier");

  function handleLogout() {
    sessionStorage.removeItem("studentIdentifier");
    sessionStorage.removeItem("studentLoginType");
    navigate("/");
  }

  return (
    <aside className="sticky top-0 flex h-screen min-h-screen w-[260px] shrink-0 flex-col border-r border-white/10 bg-black/45 backdrop-blur-md">
      <div className="border-b border-white/10 px-5 py-5">
        <OppiLogo size="sm" />
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-white/50">
          Área do aluno
        </p>
        {identifier && (
          <p className="mt-1 truncate text-sm font-medium text-white/90">
            {identifier}
          </p>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {MENU_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#e85d6f]/20 text-[#e85d6f]"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 p-4">
        <Link
          to="/dono/login"
          className="block w-full rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-medium text-white/60 transition hover:border-[#e85d6f]/40 hover:text-white"
        >
          Dono da Academia
        </Link>
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
      <path d="M4 10v4M7 8v8M17 8v8M20 10v4M7 12h10" />
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
