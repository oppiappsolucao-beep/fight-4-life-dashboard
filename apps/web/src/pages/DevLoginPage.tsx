import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ModalityCards from "../components/ModalityCards";
import OppiLogo from "../components/OppiLogo";
import { useAuth } from "../contexts/AuthContext";
import { canAccessDev } from "../lib/access";

const GYM_BG = "/hero-gym.png?v=2";

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
        navigate("/dev/cadastro-academias", { replace: true });
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
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${GYM_BG})` }}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-black/50" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col px-5 py-6 md:px-8">
        <header className="flex items-center justify-between">
          <OppiLogo size="md" />
          <Link
            to="/"
            className="rounded-full border border-white/15 px-4 py-1.5 text-[0.75rem] font-medium text-white/60 transition hover:border-[#e85d6f]/40 hover:text-white"
          >
            Área do aluno
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12">
          <section className="mb-8 hidden lg:block">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16rem] text-[#c9c9c9]">
              Oppi Tech • Plataforma
            </p>
            <h1 className="m-0 max-w-[480px] text-[clamp(1.8rem,3vw,2.6rem)] font-bold uppercase leading-tight tracking-tight text-white">
              Desenvolvimento
            </h1>
            <p className="mt-3 max-w-[420px] text-[0.85rem] leading-relaxed text-[#a8a8a8]">
              Painel central para cadastro de academias, donos e controle de
              bloqueios da plataforma.
            </p>
            <div className="mt-6 max-w-[420px]">
              <ModalityCards />
            </div>
          </section>

          <section className="w-full max-w-[440px]">
            <div className="mb-6 text-center lg:hidden">
              <h1 className="m-0 text-[clamp(1.4rem,4vw,1.9rem)] font-normal text-white/95">
                Desenvolvimento
              </h1>
              <p className="mt-2 text-[0.78rem] text-[#9a9a9a]">
                Acesso padrão da equipe Oppi Tech
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

              <div className="px-6 pt-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e85d6f]/15 text-[#e85d6f]">
                  <CodeIcon />
                </div>
                <h2 className="m-0 text-[0.9rem] font-bold uppercase tracking-wide text-white">
                  Acesso Desenvolvimento
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4">
                <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu e-mail"
                  autoComplete="off"
                  className="mb-3 w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
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
                    autoComplete="new-password"
                    className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 pr-16 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
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
                  <p className="mb-2 text-[0.75rem] text-red-300/90">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>

                <p className="mt-4 text-center text-[0.65rem] leading-snug text-[#7a7a7a]">
                  Painel exclusivo da equipe de desenvolvimento Oppi Tech.{" "}
                  <Link to="/dono/login" className="text-[#e85d6f] hover:text-[#f07080]">
                    Dono da Academia
                  </Link>
                </p>
              </form>
            </div>
          </section>
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
