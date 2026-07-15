import StudentSectionPage from "./StudentSectionPage";
import StudentTermoSaudeForm from "../../components/student/StudentTermoSaudeForm";

export default function StudentTermoSaudePage() {
  return (
    <StudentSectionPage
      title="Termo de Saúde"
      description="Consulte e assine o termo de responsabilidade e saúde da academia."
    >
      <StudentTermoSaudeForm />
    </StudentSectionPage>
  );
}
