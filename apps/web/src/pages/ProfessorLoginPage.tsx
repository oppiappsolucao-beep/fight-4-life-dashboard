import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthEntryLayout, { authInputClass, authLabelClass } from "../components/AuthEntryLayout";
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
    <AuthEntryLayout
      title="Professor"
      subtitle={
        academyName
          ? `Acesso de ${academyName}`
          : "Entre com o e-mail e senha liberados pelo dono"
      }
    >
      <form onSubmit={handleSubmit}>
        <label className={authLabelClass}>E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Digite seu e-mail"
          autoComplete="username"
          className={`mb-3 ${authInputClass}`}
          required
        />
        <label className={authLabelClass}>Senha</label>
        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            className={`pr-16 ${authInputClass}`}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.68rem] font-medium text-slate-500"
          >
            {showPassword ? "Ocultar" : "Ver"}
          </button>
        </div>
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-[#2E496C] py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar como professor"}
        </button>
      </form>
    </AuthEntryLayout>
  );
}
