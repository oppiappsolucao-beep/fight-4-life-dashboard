import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import OppiLogo from "../components/OppiLogo";
import HeroBackground from "../components/HeroBackground";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";
import { canAccessProfessor } from "../lib/access";
import { clearStudentSession } from "../lib/studentSession";
import { getHostSubdomain } from "../lib/tenantHost";

export default function ProfessorLoginPage() {
  const { professorLogin, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [academyName, setAcademyName] = useState<string | null>(null);
  const hostSub = getHostSubdomain();

  useEffect(() => {
    apiFetch<{ mode: string; tenant: { name: string } | null }>("/public/tenant-context")
      .then((data) => {
        if (data.mode === "tenant" && data.tenant) {
          setAcademyName(data.tenant.name);
        }
      })
      .catch(() => {
        // Hub ou API indisponível
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && canAccessProfessor(user.role)) {
      navigate("/professor/visao-geral", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      logout();
      clearStudentSession();
      await professorLogin(email, password, hostSub ?? undefined);
      navigate("/professor/visao-geral");
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
          <Link to="/" className="text-[0.72rem] font-medium text-white/50 hover:text-white/80">
            Voltar ao início
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-6">
          <div className="mb-5 text-center">
            <h1 className="m-0 text-2xl font-normal text-white/95">Professor</h1>
            <p className="mt-2 text-sm text-white/55">
              {academyName
                ? `Acesso de ${academyName}`
                : hostSub
                  ? "Entre com o e-mail liberado nesta academia"
                  : "Use o link da sua academia (ex.: suaacademia.oppifit.com.br/professor/login)"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md"
          >
            <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              autoComplete="username"
              className="mb-3 w-full rounded-xl border border-white/12 bg-[#0d1117] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#4a9fd8]/70 focus:ring-2 focus:ring-[#4a9fd8]/20"
              required
            />
            <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
              Senha
            </label>
            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/12 bg-[#0d1117] px-3 py-3 pr-16 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#4a9fd8]/70 focus:ring-2 focus:ring-[#4a9fd8]/20"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.68rem] font-medium text-white/45"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
            {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#4a9fd8] to-[#d44d62] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar como professor"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
