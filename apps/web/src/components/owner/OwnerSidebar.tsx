import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import OppiLogo from "../OppiLogo";

const MENU_ITEMS = [
  { to: "/dono/cadastro-aluno", label: "Cadastro Aluno", icon: UserPlusIcon },
  { to: "/dono/alunos", label: "Alunos", icon: UsersIcon },
  { to: "/dono/cadastro-treino", label: "Cadastro de Treino", icon: DumbbellIcon },
  { to: "/dono/planos", label: "Planos", icon: PlanIcon },
  { to: "/dono/contas-a-pagar", label: "Contas a Pagar", icon: PaymentIcon },
];

export default function OwnerSidebar() {
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/dono/login");
  }

  return (
    <aside className="sticky top-0 flex h-screen min-h-screen w-[280px] shrink-0 flex-col border-r border-white/10 bg-black/45 backdrop-blur-md">
      <div className="border-b border-white/10 px-5 py-5">
        <OppiLogo size="sm" />
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
          Dono da Academia
        </p>
        {tenant?.name && (
          <p className="mt-1 truncate text-sm font-medium text-white/90">
            {tenant.name}
          </p>
        )}
        {user?.name && (
          <p className="mt-0.5 truncate text-xs text-white/50">{user.name}</p>
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
        <NavLink
          to="/"
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

function UserPlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="4" />
      <path d="M4 20c1.5-4 6-4 10-4M19 8v6M16 11h6" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c1-4 5-6 12-6M16 8a3 3 0 1 1 0 6M21 20c0-3.5-2.5-5.5-5-6.5" />
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

function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </svg>
  );
}
