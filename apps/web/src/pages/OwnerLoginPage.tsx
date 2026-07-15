import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ModalityCards from "../components/ModalityCards";
import OppiLogo from "../components/OppiLogo";
import HeroBackground from "../components/HeroBackground";
import { useAuth } from "../contexts/AuthContext";
import { canAccessOwner } from "../lib/access";

export default function OwnerLoginPage() {
  const { ownerLogin, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (canAccessOwner(user.role)) {
        navigate("/dono/cadastro-aluno", { replace: true });
        return;
      }
      logout();
      setError("Use o e-mail e senha liberados no cadastro da academia.");
    }
  }, [isAuthenticated, user, navigate, logout]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      logout();
      await ownerLogin(email, password);
      navigate("/dono/cadastro-aluno");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <HeroBackground />

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
              Oppi Tech • Gestão
            </p>
            <h1 className="m-0 max-w-[480px] text-[clamp(1.8rem,3vw,2.6rem)] font-bold uppercase leading-tight tracking-tight text-white">
              Dono da Academia
            </h1>
            <p className="mt-3 max-w-[420px] text-[0.85rem] leading-relaxed text-[#a8a8a8]">
              Entre com o e-mail e senha definidos no cadastro da sua academia
              pela equipe de desenvolvimento.
            </p>
            <div className="mt-6 max-w-[420px]">
              <ModalityCards />
            </div>
          </section>

          <section className="w-full max-w-[440px]">
            <div className="mb-6 text-center lg:hidden">
              <h1 className="m-0 text-[clamp(1.4rem,4vw,1.9rem)] font-normal text-white/95">
                Dono da Academia
              </h1>
              <p className="mt-2 text-[0.78rem] text-[#9a9a9a]">
                E-mail e senha do cadastro da academia
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

              <div className="px-6 pt-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e85d6f]/15 text-[#e85d6f]">
                  <ShieldIcon />
                </div>
                <h2 className="m-0 text-[0.9rem] font-bold uppercase tracking-wide text-white">
                  Acesso do Dono
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
                  Painel exclusivo para o dono da academia.{" "}
                  <Link to="/" className="text-[#e85d6f] hover:text-[#f07080]">
                    Área do aluno
                  </Link>
                  {" · "}
                  <Link to="/dev/login" className="text-[#e85d6f] hover:text-[#f07080]">
                    Desenvolvimento
                  </Link>
                </p>
                <p className="mt-2 text-center text-[0.62rem] leading-snug text-[#6a6a6a]">
                  Não sabe o e-mail? Entre em Desenvolvimento →{" "}
                  <Link to="/dev/donos-academias" className="text-[#e85d6f] hover:text-[#f07080]">
                    Donos de Academias
                  </Link>{" "}
                  para ver o login cadastrado.
                </p>
              </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7l-8-4Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
