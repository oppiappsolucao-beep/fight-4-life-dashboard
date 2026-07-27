import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatCpf } from "../../lib/format";
import { getStudentSession } from "../../lib/studentSession";
import { formatWorkoutDateLabel } from "../../lib/workout";
import StudentSectionPage from "./StudentSectionPage";

interface PerfilData {
  nomeCompleto: string;
  cpf: string;
  email: string;
  fotoUrl: string | null;
  termoSaudeSignedAt: string | null;
  termoSaudeSignedIp: string | null;
}

export default function StudentPerfilPage() {
  const session = getStudentSession();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id) {
      setLoading(false);
      return;
    }

    apiFetch<{ aluno: PerfilData }>("/student/perfil", {}, session.id)
      .then((data) => setPerfil(data.aluno))
      .catch(() =>
        setPerfil({
          nomeCompleto: session.nomeCompleto,
          cpf: session.cpf,
          email: session.email,
          fotoUrl: null,
          termoSaudeSignedAt: null,
          termoSaudeSignedIp: null,
        }),
      )
      .finally(() => setLoading(false));
  }, [session?.id, session?.nomeCompleto, session?.cpf, session?.email]);

  const nome = perfil?.nomeCompleto ?? session?.nomeCompleto ?? "—";
  const cpf = perfil?.cpf ?? session?.cpf ?? "";
  const email = perfil?.email ?? session?.email ?? "—";

  return (
    <StudentSectionPage
      title="Perfil"
      description="Suas informações de acesso na área do aluno."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-8 text-center text-sm text-white/50">
          Carregando...
        </div>
      ) : (
        <div className="grid max-w-xl gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Foto</p>
            <div className="mt-3 flex items-center gap-4">
              {perfil?.fotoUrl ? (
                <img
                  src={perfil.fotoUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white/50">
                  {nome.slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="m-0 text-sm text-white/55">
                {perfil?.fotoUrl
                  ? "Foto cadastrada pela academia."
                  : "Nenhuma foto cadastrada no seu perfil."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Nome</p>
            <p className="mt-2 text-lg font-medium text-white">{nome}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">CPF</p>
            <p className="mt-2 text-lg font-medium text-white">
              {cpf ? formatCpf(cpf) : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">E-mail</p>
            <p className="mt-2 break-all text-lg font-medium text-white">{email}</p>
          </div>

          {perfil?.termoSaudeSignedAt ? (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">
                Termo de saúde
              </p>
              <p className="mt-2 text-sm text-white/75">
                Assinado em{" "}
                <strong>
                  {formatWorkoutDateLabel(perfil.termoSaudeSignedAt.slice(0, 10))}
                </strong>{" "}
                às{" "}
                <strong>
                  {new Date(perfil.termoSaudeSignedAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </StudentSectionPage>
  );
}
