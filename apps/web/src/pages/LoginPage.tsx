import { FormEvent, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ModalityCards from "../components/ModalityCards";
import OppiLogo from "../components/OppiLogo";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[1200px] px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <OppiLogo size="sm" />
        <Link
          to="/"
          className="text-[0.72rem] font-medium text-white/50 transition hover:text-white/80"
        >
          Voltar ao início
        </Link>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_0.9fr] lg:gap-12">
        <section>
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16rem] text-[#c9c9c9]">
            Oppi Tech • Dashboard
          </p>
          <h1 className="m-0 max-w-[580px] text-[clamp(1.75rem,3.2vw,2.75rem)] font-bold uppercase leading-[1.05] tracking-[-0.04rem] text-white">
            Gestão <span className="text-white/35">•</span> Processos{" "}
            <span className="text-white/35">•</span>{" "}
            <span className="bg-gradient-to-r from-[#e85d6f] to-[#b84d6a] bg-clip-text text-transparent">
              Resultados
            </span>
          </h1>
          <p className="mt-3 max-w-[520px] text-[0.82rem] leading-relaxed text-[#9a9a9a]">
            Tecnologia, organização e dados em um painel interno preparado
            para acompanhar a operação em tempo real.
          </p>
          <div className="mt-6">
            <ModalityCards />
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 pb-4 pt-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />
          <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#e85d6f]/5" />

          <div className="relative z-10">
            <h2 className="m-0 text-center text-[0.9rem] font-bold uppercase tracking-wide text-white">
              Acesse o dashboard
            </h2>
            <p className="mx-auto mt-2 max-w-[300px] text-center text-[0.72rem] leading-snug text-[#8f8f8f]">
              Entre com suas credenciais para visualizar o painel interno da
              Oppi Tech.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/80">
                  Usuário
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="w-full rounded-lg border border-white/20 bg-white px-3 py-2 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/80">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full rounded-lg border border-white/20 bg-white px-3 py-2 pr-10 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.68rem] font-medium text-zinc-500"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-[0.75rem] text-red-300/90">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <p className="mt-4 border-l-2 border-[#e85d6f]/30 pl-3 text-[0.65rem] leading-snug text-[#7a7a7a]">
              Painel exclusivo para acesso interno.
              <br />
              Utilize suas credenciais para continuar.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
