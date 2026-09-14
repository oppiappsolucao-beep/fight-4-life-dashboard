import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthEntryLayout, { authInputClass } from "../components/AuthEntryLayout";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, setTenantSlug } from "../lib/api";
import { formatCpf } from "../lib/format";
import { clearStudentSession, setStudentSession } from "../lib/studentSession";

type LoginStep = "identify" | "password";
type ProfileType = "student" | "owner" | "dev" | "professor";

interface LookupResponse {
  type: ProfileType;
  name: string | null;
  email?: string;
  loginType?: "cpf" | "email";
  tenant?: {
    slug: string;
    name: string;
  };
}

interface StudentLoginResponse {
  student: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    email: string;
  };
  tenant: {
    id: string;
    slug: string;
    name: string;
  };
}

const PROFILE_LABELS: Record<ProfileType, string> = {
  student: "Área do Aluno",
  owner: "Dono da Academia",
  dev: "Desenvolvimento",
  professor: "Professor",
};

function looksLikeEmailInput(value: string): boolean {
  return /[a-zA-Z@]/.test(value);
}

function formatIdentifierInput(value: string): string {
  if (looksLikeEmailInput(value)) {
    return value;
  }
  return formatCpf(value);
}

export default function StudentLoginPage() {
  const { login, ownerLogin, professorLogin, logout } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>("identify");
  const [profile, setProfile] = useState<LookupResponse | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function resetToIdentify() {
    setStep("identify");
    setProfile(null);
    setPassword("");
    setError("");
  }

  function handleIdentifierChange(value: string) {
    setIdentifier(formatIdentifierInput(value));
    setError("");
  }

  async function completeStudentLogin(
    loginType: "cpf" | "email",
    value: string,
  ) {
    const data = await apiFetch<StudentLoginResponse>("/auth/student-login", {
      method: "POST",
      body: JSON.stringify({ type: loginType, identifier: value }),
    });

    setTenantSlug(data.tenant.slug);
    setStudentSession({
      id: data.student.id,
      nomeCompleto: data.student.nomeCompleto,
      cpf: data.student.cpf,
      email: data.student.email,
      identifier:
        loginType === "cpf" ? formatCpf(data.student.cpf) : data.student.email,
      loginType,
      tenantSlug: data.tenant.slug,
      tenantName: data.tenant.name,
    });
    navigate("/inicio");
  }

  async function handleIdentify(event: FormEvent) {
    event.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError("Informe seu CPF ou e-mail cadastrado.");
      return;
    }

    setLoading(true);

    try {
      logout();
      clearStudentSession();

      const lookup = await apiFetch<LookupResponse>("/auth/lookup", {
        method: "POST",
        body: JSON.stringify({ identifier: value }),
      });

      if (lookup.type === "student") {
        await completeStudentLogin(lookup.loginType ?? "cpf", value);
        return;
      }

      if (lookup.tenant?.slug) {
        setTenantSlug(lookup.tenant.slug);
      }

      setProfile(lookup);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar cadastro.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!profile?.email) {
      setError("Sessão expirada. Informe CPF ou e-mail novamente.");
      resetToIdentify();
      return;
    }

    if (!password.trim()) {
      setError("Informe sua senha.");
      return;
    }

    setLoading(true);

    try {
      logout();
      clearStudentSession();

      // logout() limpa o tenantSlug — reaplicar o da academia antes do login
      const academySlug = profile.tenant?.slug;
      if (academySlug) {
        setTenantSlug(academySlug);
      }

      if (profile.type === "owner") {
        await ownerLogin(profile.email, password, academySlug);
        navigate("/dono/visao-geral");
        return;
      }

      if (profile.type === "professor") {
        await professorLogin(profile.email, password, academySlug);
        navigate("/professor/aulas");
        return;
      }

      await login(profile.email, password);
      navigate("/dev/visao-geral");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  const academyLabel = profile?.tenant?.name?.replace(/^\$+/, "").trim();
  const headerSubtitle =
    step === "identify"
      ? "Informe CPF ou e-mail — reconhecemos seu perfil automaticamente"
      : profile?.type === "owner"
        ? academyLabel
          ? `Acesso de dono · ${academyLabel}`
          : "Digite a senha de dono da academia"
        : profile?.type === "professor"
          ? academyLabel
            ? `Professor · ${academyLabel}`
            : "Digite a senha de professor"
          : profile?.email
            ? `${PROFILE_LABELS[profile.type]} · ${profile.email}`
            : "Digite sua senha para continuar";

  return (
    <AuthEntryLayout
      showBack={false}
      title={
        step === "password" && profile?.name
          ? `Olá, ${profile.name.split(" ")[0]}!`
          : "Seja bem-vindo"
      }
      subtitle={headerSubtitle}
    >
      {step === "identify" ? (
        <form onSubmit={handleIdentify}>
          <input
            type="text"
            value={identifier}
            onChange={(e) => handleIdentifierChange(e.target.value)}
            placeholder="000.000.000-00 ou seu@email.com"
            autoComplete="username"
            className={`mb-2 ${authInputClass}`}
          />

          {error && (
            <p className="mb-2 text-[0.75rem] leading-snug text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-[#2E496C] py-3 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:bg-[#243a58] disabled:opacity-60"
          >
            {loading ? "Verificando..." : "Continuar"}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordSubmit}>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              autoFocus
              className={`mb-2 pr-16 ${authInputClass}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.68rem] font-medium text-slate-500"
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          {error && (
            <p className="mb-2 text-[0.75rem] leading-snug text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-[#2E496C] py-3 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:bg-[#243a58] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={resetToIdentify}
            className="mt-3 w-full py-2 text-[0.72rem] font-medium text-[#5B7595] transition hover:text-[#2E496C]"
          >
            Voltar
          </button>
        </form>
      )}
    </AuthEntryLayout>
  );
}
