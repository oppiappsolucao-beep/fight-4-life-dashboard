import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import OppiLogo from "../../components/OppiLogo";
import HeroBackground from "../../components/HeroBackground";
import { useAuth } from "../../contexts/AuthContext";
import { canAccessProfessor } from "../../lib/access";
import { clearStudentSession } from "../../lib/studentSession";

export default function ProfessorLoginPage() {
  const { professorLogin, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && canAccessProfessor(user.role)) {
      navigate("/professor/aulas", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      logout();
      clearStudentSession();
      await professorLogin(email, password);
      navigate("/professor/aulas");
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
              Publique aulas em vídeo das modalidades liberadas pelo dono
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="mb-3 w-full rounded-lg border border-white/20 bg-white px-3 py-3 text-sm text-black"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="mb-3 w-full rounded-lg border border-white/20 bg-white px-3 py-3 text-sm text-black"
              required
            />
            {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#e85d6f] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar como professor"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
