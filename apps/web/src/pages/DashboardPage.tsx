import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardPage() {
  const { user, tenant, logout } = useAuth();

  return (
    <div className="mx-auto min-h-screen max-w-[1460px] px-4 py-6">
      <header className="mb-6 flex items-center justify-between rounded-[18px] border border-border bg-surface px-5 py-4">
        <div>
          <h1 className="m-0 text-[1.52rem] text-white">
            {tenant?.name ?? "Dashboard"}
          </h1>
          <p className="mt-1 text-[0.66rem] font-extrabold uppercase tracking-[0.11rem] text-brand">
            Painel interno SaaS
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/"
            className="rounded-[10px] border border-white/20 px-4 py-2 text-[0.75rem] font-bold uppercase text-white/70 transition hover:bg-white/5"
          >
            Início
          </Link>
          <button
            onClick={logout}
            className="rounded-[10px] border border-brand/40 px-4 py-2 text-[0.75rem] font-bold uppercase text-brand transition hover:bg-brand/10"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.08rem] text-zinc-400">
            Usuário
          </p>
          <p className="mt-3 text-2xl font-extrabold text-brand">
            {user?.name ?? user?.email}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.08rem] text-zinc-400">
            Perfil
          </p>
          <p className="mt-3 text-2xl font-extrabold text-brand">{user?.role}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.08rem] text-zinc-400">
            Academia
          </p>
          <p className="mt-3 text-2xl font-extrabold text-brand">
            {tenant?.slug}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h2 className="m-0 text-lg font-extrabold text-white">
          Fase 1 concluída
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          A base Node.js + React + PostgreSQL está pronta. As próximas fases
          incluem o módulo Comercial, Cadastro de Alunos, ZapSign e Diretoria.
        </p>
      </section>
    </div>
  );
}
