import DevSectionPage from "./DevSectionPage";
import DevAcademiaForm from "../../components/dev/DevAcademiaForm";

export default function DevCadastroAcademiasPage() {
  return (
    <DevSectionPage
      title="Cadastro de Academias"
      description="Cadastre novas academias, configure subdomínios, branding e status de bloqueio."
    >
      <DevAcademiaForm />
    </DevSectionPage>
  );
}
