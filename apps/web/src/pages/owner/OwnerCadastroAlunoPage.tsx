import OwnerSectionPage from "./OwnerSectionPage";
import OwnerCadastroAlunoForm from "../../components/owner/OwnerCadastroAlunoForm";

export default function OwnerCadastroAlunoPage() {
  return (
    <OwnerSectionPage
      title="Cadastro Aluno"
      description="Cadastre novos alunos com dados pessoais, contato, matrícula e foto."
    >
      <OwnerCadastroAlunoForm />
    </OwnerSectionPage>
  );
}
