import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import OppiLogo from "../components/OppiLogo";
import HeroBackground from "../components/HeroBackground";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, setTenantSlug } from "../lib/api";
import { formatCpf } from "../lib/format";
import { clearStudentSession, setStudentSession } from "../lib/studentSession";

type LoginStep = "identify" | "password";
type ProfileType = "student" | "owner" | "dev";

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
  const { login, ownerLogin, logout } = useAuth();
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
    });
    navigate("/treino");
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

      if (profile.type === "owner") {
        await ownerLogin(profile.email, password);
        navigate("/dono/cadastro-aluno");
        return;
      }

      if (profile.tenant?.slug) {
        setTenantSlug(profile.tenant.slug);
      }

      await login(profile.email, password);
      navigate("/dev/cadastro-academias");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  const headerSubtitle =
    step === "identify"
      ? "Informe CPF ou e-mail — reconhecemos seu perfil automaticamente"
      : profile?.type === "owner"
        ? `Entre na ${profile.tenant?.name ?? "sua academia"}`
        : profile?.email
          ? `${PROFILE_LABELS[profile.type]} • ${profile.email}`
          : "Digite sua senha para continuar";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <HeroBackground />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6 sm:px-6">
        <header className="flex justify-center pt-2 sm:pt-4">
          <OppiLogo size="md" />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="mb-6 text-center">
            <h1 className="m-0 text-[clamp(1.35rem,5vw,1.85rem)] font-normal text-white/95">
              {step === "password" && profile?.name
                ? `Olá, ${profile.name.split(" ")[0]}!`
                : "Seja bem vindo!"}
            </h1>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#9a9a9a]">
              {headerSubtitle}
            </p>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

            {step === "identify" ? (
              <form onSubmit={handleIdentify} className="px-5 py-6 sm:px-6">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder="000.000.000-00 ou seu@email.com"
                  autoComplete="username"
                  className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-3 text-[0.9rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
                />

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
                  {loading ? "Verificando..." : "Continuar"}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="px-5 py-6 sm:px-6">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    autoFocus
                    className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-3 pr-16 text-[0.9rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
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

                <button
                  type="button"
                  onClick={resetToIdentify}
                  className="mt-3 w-full py-2 text-[0.72rem] font-medium text-white/45 transition hover:text-white/70"
                >
                  Voltar
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
