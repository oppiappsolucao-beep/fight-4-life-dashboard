import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import ModalityCards from "../ModalityCards";
import { formatCpf, formatPhone } from "../../lib/format";

type LoginTab = "cpf" | "email" | "telefone";

const TAB_CONFIG: Record<
  LoginTab,
  { label: string; placeholder: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }
> = {
  cpf: { label: "CPF", placeholder: "000.000.000-00", inputMode: "numeric" },
  email: { label: "E-mail", placeholder: "seu@email.com", inputMode: "email" },
  telefone: { label: "Telefone", placeholder: "(00) 00000-0000", inputMode: "tel" },
};

export default function StudentLoginForm() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LoginTab>("cpf");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleTabChange(next: LoginTab) {
    setTab(next);
    setIdentifier("");
    setError("");
  }

  function handleInputChange(value: string) {
    if (tab === "cpf") {
      setIdentifier(formatCpf(value));
      return;
    }
    if (tab === "telefone") {
      setIdentifier(formatPhone(value));
      return;
    }
    setIdentifier(value);
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
    await new Promise((resolve) => setTimeout(resolve, 500));

    sessionStorage.setItem("studentIdentifier", value);
    sessionStorage.setItem("studentLoginType", tab);
    setLoading(false);
    navigate("/treino");
  }

  return (
    <div className="flex min-h-full items-center px-6 py-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1000px] items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16rem] text-[#c9c9c9]">
            Oppi Tech • Academia
          </p>
          <h1 className="m-0 text-[clamp(1.8rem,3vw,2.5rem)] font-bold uppercase leading-tight tracking-tight text-white">
            Seja bem vindo!
          </h1>
          <p className="mt-3 max-w-[400px] text-[0.85rem] leading-relaxed text-[#a8a8a8]">
            Acesse sua área com CPF, e-mail ou telefone cadastrado na academia.
          </p>
          <div className="mt-6 max-w-[400px]">
            <ModalityCards />
          </div>
        </section>

        <section>
          <div className="mb-6 text-center lg:hidden">
            <h1 className="m-0 text-[clamp(1.4rem,4vw,1.9rem)] font-normal text-white/95">
              Seja bem vindo!
            </h1>
            <p className="mt-2 text-[0.78rem] text-[#9a9a9a]">
              Acesse com CPF, e-mail ou telefone cadastrado
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e85d6f]/40 to-transparent" />

            <div className="px-6 pt-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e85d6f]/15 text-[#e85d6f]">
                <UserIcon />
              </div>
              <h2 className="m-0 text-[0.9rem] font-bold uppercase tracking-wide text-white">
                Área de Aluno
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4">
              <div className="mb-4 flex rounded-lg border border-white/10 bg-black/20 p-1">
                {(Object.keys(TAB_CONFIG) as LoginTab[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabChange(key)}
                    className={`flex-1 rounded-md px-2 py-2 text-[0.68rem] font-semibold uppercase tracking-wide transition ${
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
                className="mb-2 w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15"
              />

              {error && (
                <p className="mb-2 text-[0.75rem] text-red-300/90">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? "Verificando..." : "Continuar"}
              </button>

              <p className="mt-4 text-center text-[0.65rem] leading-snug text-[#7a7a7a]">
                Primeiro acesso?{" "}
                <span className="text-[#e85d6f]">Fale com a recepção</span>
              </p>
            </form>
          </div>
        </section>
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
