import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import OppiLogo from "../components/OppiLogo";
import HeroBackground from "../components/HeroBackground";
import { useAuth } from "../contexts/AuthContext";
import { canAccessDev } from "../lib/access";
import { clearStudentSession } from "../lib/studentSession";

export default function DevLoginPage() {
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (canAccessDev(user.role)) {
        navigate("/dev/visao-geral", { replace: true });
      } else {
        logout();
        setError("Acesso restrito à equipe de desenvolvimento.");
      }
    }
  }, [isAuthenticated, user, navigate, logout]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      logout();
      clearStudentSession();
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <HeroBackground />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-5 sm:px-6">
        <header className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between sm:pt-4">
          <OppiLogo size="md" />
          <Link
            to="/"
            className="text-[0.72rem] font-medium text-white/50 transition hover:text-white/80"
          >
            Voltar ao início
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-6 sm:py-10">
          <div className="mb-5 text-center sm:mb-6">
            <h1 className="m-0 text-[clamp(1.35rem,5vw,1.85rem)] font-normal text-white/95">
              Desenvolvimento
            </h1>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#9a9a9a] sm:text-[0.82rem]">
              Acesso exclusivo da equipe Oppi Tech
            </p>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

            <div className="px-5 pt-6 text-center sm:px-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e85d6f]/15 text-[#e85d6f]">
                <CodeIcon />
              </div>
              <h2 className="m-0 text-[0.9rem] font-bold uppercase tracking-wide text-white">
                Acesso Desenvolvimento
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-6 pt-4 sm:px-6">
              <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu e-mail"
                autoComplete="username"
                className="mb-3 w-full rounded-lg border border-white/20 bg-white px-3 py-3 text-[0.9rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
                required
              />

              <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-3 pr-16 text-[0.9rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.68rem] font-medium text-zinc-500"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>

              {error && (
                <p className="mb-2 text-[0.75rem] leading-snug text-red-300/90">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] py-3 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function CodeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 8 4 12l4 4M16 8l4 4-4 4M14 4l-4 16" />
    </svg>
  );
}
