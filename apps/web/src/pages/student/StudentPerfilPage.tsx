import StudentSectionPage from "./StudentSectionPage";

export default function StudentPerfilPage() {
  const identifier = sessionStorage.getItem("studentIdentifier") ?? "—";
  const loginType = sessionStorage.getItem("studentLoginType") ?? "cpf";

  return (
    <StudentSectionPage
      title="Perfil"
      description="Suas informações de acesso na área do aluno."
    >
      <div className="grid max-w-xl gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Identificação
          </p>
          <p className="mt-2 text-lg font-medium text-white">{identifier}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Tipo de acesso
          </p>
          <p className="mt-2 text-lg font-medium capitalize text-white">
            {loginType}
          </p>
        </div>
      </div>
    </StudentSectionPage>
  );
}
