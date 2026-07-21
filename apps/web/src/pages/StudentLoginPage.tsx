import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import OppiLogo from "../components/OppiLogo";
import HeroBackground from "../components/HeroBackground";
import { apiFetch, setTenantSlug } from "../lib/api";
import { formatCpf } from "../lib/format";
import {
  setStudentSession,
  type StudentLoginType,
} from "../lib/studentSession";

const TAB_CONFIG: Record<
  StudentLoginType,
  {
    label: string;
    placeholder: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  }
> = {
  cpf: { label: "CPF", placeholder: "000.000.000-00", inputMode: "numeric" },
  email: { label: "E-mail", placeholder: "seu@email.com", inputMode: "email" },
};

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

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<StudentLoginType>("cpf");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleTabChange(next: StudentLoginType) {
    setTab(next);
    setIdentifier("");
    setError("");
  }

  function handleInputChange(value: string) {
    setIdentifier(tab === "cpf" ? formatCpf(value) : value);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const value = identifier.trim();
    if (!value) {
      setError(`Informe seu ${TAB_CONFIG[tab].label.toLowerCase()} cadastrado.`);
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch<StudentLoginResponse>("/auth/student-login", {
        method: "POST",
        body: JSON.stringify({ type: tab, identifier: value }),
      });

      setTenantSlug(data.tenant.slug);
      setStudentSession({
        id: data.student.id,
        nomeCompleto: data.student.nomeCompleto,
        cpf: data.student.cpf,
        email: data.student.email,
        identifier: tab === "cpf" ? formatCpf(data.student.cpf) : data.student.email,
        loginType: tab,
        tenantSlug: data.tenant.slug,
      });
      navigate("/treino");
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
        <header className="flex justify-center pt-2 sm:pt-4">
          <OppiLogo size="md" />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-6 sm:py-10">
          <div className="mb-5 text-center sm:mb-6">
            <h1 className="m-0 text-[clamp(1.35rem,5vw,1.85rem)] font-normal text-white/95">
              Seja bem vindo!
            </h1>
            <p className="mt-2 text-[0.78rem] leading-relaxed text-[#9a9a9a] sm:text-[0.82rem]">
              Acesse com CPF ou e-mail cadastrado na academia
            </p>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

            <div className="px-5 pt-6 text-center sm:px-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e85d6f]/15 text-[#e85d6f]">
                <UserIcon />
              </div>
              <h2 className="m-0 text-[0.9rem] font-bold uppercase tracking-wide text-white">
                Área de Aluno
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-6 pt-4 sm:px-6">
              <div className="mb-4 flex rounded-lg border border-white/10 bg-black/20 p-1">
                {(Object.keys(TAB_CONFIG) as StudentLoginType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabChange(key)}
                    className={`flex-1 rounded-md px-2 py-2.5 text-[0.68rem] font-semibold uppercase tracking-wide transition sm:text-[0.72rem] ${
                      tab === key
                        ? "bg-gradient-to-r from-[#e85d6f] to-[#d44d62] text-white"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {TAB_CONFIG[key].label}
                  </button>
                ))}
              </div>

              <label className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
                {TAB_CONFIG[tab].label}
              </label>
              <input
                type={tab === "email" ? "email" : "text"}
                inputMode={TAB_CONFIG[tab].inputMode}
                value={identifier}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={TAB_CONFIG[tab].placeholder}
                autoComplete={tab === "email" ? "email" : "off"}
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

              <p className="mt-4 text-center text-[0.65rem] leading-snug text-[#7a7a7a]">
                Primeiro acesso?{" "}
                <span className="text-[#e85d6f]">Fale com a recepção</span>
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-4 13.5-4 14 0" />
    </svg>
  );
}
