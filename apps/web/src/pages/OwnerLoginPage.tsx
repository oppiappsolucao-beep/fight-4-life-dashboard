import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthEntryLayout, { authInputClass, authLabelClass } from "../components/AuthEntryLayout";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";
import { canAccessOwner } from "../lib/access";
import { clearStudentSession } from "../lib/studentSession";
import { getAcademyAccessSlug } from "../lib/tenantHost";

export default function OwnerLoginPage() {
  const { ownerLogin, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [academyName, setAcademyName] = useState<string | null>(null);
  const academySlug = getAcademyAccessSlug();

  useEffect(() => {
    apiFetch<{ mode: string; tenant: { name: string } | null }>("/public/tenant-context")
      .then((data) => {
        if (data.mode === "tenant" && data.tenant) {
          setAcademyName(data.tenant.name);
        }
      })
      .catch(() => {
        // Hub ou API indisponível — login ainda pode funcionar via header/local
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (canAccessOwner(user.role)) {
        navigate("/dono/visao-geral", { replace: true });
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
      clearStudentSession();
      await ownerLogin(email, password, academySlug ?? undefined);
      navigate("/dono/visao-geral");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthEntryLayout
      title="Dono da Academia"
      subtitle={
        academyName
          ? `Acesso de ${academyName}`
          : "Entre com e-mail e senha do cadastro da academia"
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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            className={`mb-2 pr-16 ${authInputClass}`}
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

        {error && <p className="mb-2 text-[0.75rem] leading-snug text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-[#2E496C] py-3 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:bg-[#243a58] disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthEntryLayout>
  );
}
