import OwnerSectionPage from "./OwnerSectionPage";
import OwnerCadastroAlunoForm from "../../components/owner/OwnerCadastroAlunoForm";

export default function OwnerCadastroAlunoPage() {
  return (
    <OwnerSectionPage
      title="Cadastro de aluno"
      description="Preencha em etapas: dados pessoais, contato, matrícula e foto."
    >
      <OwnerCadastroAlunoForm />
    </OwnerSectionPage>
  );
}
