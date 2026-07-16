import { ReactNode, useEffect } from "react";
import OppiLogo from "./OppiLogo";

interface DashboardShellProps {
  title: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  sidebar: ReactNode;
  children: ReactNode;
}

export default function DashboardShell({
  title,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  sidebar,
  children,
}: DashboardShellProps) {
  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <div className="relative z-10 flex min-h-screen min-w-0 items-stretch">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-black/85 px-4 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white"
        >
          <MenuIcon />
        </button>
        <div className="min-w-0 flex-1">
          <OppiLogo size="sm" />
        </div>
        <p className="max-w-[40%] truncate text-[0.65rem] font-semibold uppercase tracking-[0.08rem] text-[#e85d6f]">
          {title}
        </p>
      </header>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/65 md:hidden"
          onClick={onCloseMenu}
        />
      ) : null}

      {sidebar}

      <main className="min-h-screen min-w-0 flex-1 overflow-x-hidden overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}

export function sidebarShellClass(open: boolean): string {
  return [
    "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(280px,86vw)] shrink-0 flex-col",
    "border-r border-white/10 bg-black/95 backdrop-blur-md transition-transform duration-200",
    open ? "translate-x-0" : "-translate-x-full",
    "md:static md:z-auto md:h-screen md:w-[280px] md:translate-x-0 md:bg-black/45",
  ].join(" ");
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
