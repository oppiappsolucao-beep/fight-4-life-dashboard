import StudentSectionPage from "./StudentSectionPage";
import { getStudentSession } from "../../lib/studentSession";
import { formatCpf } from "../../lib/format";

export default function StudentPerfilPage() {
  const session = getStudentSession();

  return (
    <StudentSectionPage
      title="Perfil"
      description="Suas informações de acesso na área do aluno."
    >
      <div className="grid max-w-xl gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Nome
          </p>
          <p className="mt-2 text-lg font-medium text-white">
            {session?.nomeCompleto ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            CPF
          </p>
          <p className="mt-2 text-lg font-medium text-white">
            {session?.cpf ? formatCpf(session.cpf) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            E-mail
          </p>
          <p className="mt-2 break-all text-lg font-medium text-white">
            {session?.email ?? "—"}
          </p>
        </div>
      </div>
    </StudentSectionPage>
  );
}
