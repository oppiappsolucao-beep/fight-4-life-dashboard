import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import HomePage from "./pages/HomePage";
import PlaceholderPage from "./pages/PlaceholderPage";
import StudentLayout from "./components/student/StudentLayout";
import StudentLoginPage from "./pages/StudentLoginPage";
import StudentVisaoGeralPage from "./pages/student/StudentVisaoGeralPage";
import StudentTreinoPage from "./pages/student/StudentTreinoPage";
import StudentPagamentosPage from "./pages/student/StudentPagamentosPage";
import StudentFrequenciaPage from "./pages/student/StudentFrequenciaPage";
import StudentAtendimentoPage from "./pages/student/StudentAtendimentoPage";
import StudentDietasPage from "./pages/student/StudentDietasPage";
import StudentPerfilPage from "./pages/student/StudentPerfilPage";
import StudentTermoSaudePage from "./pages/student/StudentTermoSaudePage";
import OwnerLayout from "./components/owner/OwnerLayout";
import OwnerLoginPage from "./pages/OwnerLoginPage";
import OwnerVisaoGeralPage from "./pages/owner/OwnerVisaoGeralPage";
import OwnerCadastroAlunoPage from "./pages/owner/OwnerCadastroAlunoPage";
import OwnerAlunosPage from "./pages/owner/OwnerAlunosPage";
import OwnerCadastroTreinoPage from "./pages/owner/OwnerCadastroTreinoPage";
import OwnerPlanosPage from "./pages/owner/OwnerPlanosPage";
import OwnerContasReceberPage from "./pages/owner/OwnerContasReceberPage";
import DevLayout from "./components/dev/DevLayout";
import DevLoginPage from "./pages/DevLoginPage";
import DevVisaoGeralPage from "./pages/dev/DevVisaoGeralPage";
import DevCadastroAcademiasPage from "./pages/dev/DevCadastroAcademiasPage";
import DevDonosAcademiasPage from "./pages/dev/DevDonosAcademiasPage";
import DevContasReceberPage from "./pages/dev/DevContasReceberPage";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Carregando...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<StudentLoginPage />} />

      <Route element={<StudentLayout />}>
        <Route path="inicio" element={<StudentVisaoGeralPage />} />
        <Route path="treino" element={<StudentTreinoPage />} />
        <Route path="pagamentos" element={<StudentPagamentosPage />} />
        <Route path="frequencia" element={<StudentFrequenciaPage />} />
        <Route path="atendimento" element={<StudentAtendimentoPage />} />
        <Route path="dietas" element={<StudentDietasPage />} />
        <Route path="termo-saude" element={<StudentTermoSaudePage />} />
        <Route path="perfil" element={<StudentPerfilPage />} />
      </Route>

      <Route path="/home" element={<HomePage />} />
      <Route path="/dono/login" element={<OwnerLoginPage />} />
      <Route path="/dev/login" element={<DevLoginPage />} />
      <Route path="/login" element={<Navigate to="/dono/login" replace />} />
      <Route path="/aluno/login" element={<Navigate to="/" replace />} />
      <Route path="/aluno/*" element={<Navigate to="/inicio" replace />} />

      <Route
        path="/horarios"
        element={
          <PlaceholderPage
            title="Consultar horários"
            description="Em breve você poderá ver os horários das aulas por modalidade."
          />
        }
      />
      <Route
        path="/biometria"
        element={
          <PlaceholderPage
            title="Importar biometria"
            description="Funcionalidade de biometria em desenvolvimento."
          />
        }
      />
      <Route
        path="/treinos"
        element={
          <PlaceholderPage
            title="Treinos"
            description="Área de treinos em desenvolvimento."
          />
        }
      />

      <Route element={<OwnerLayout />}>
        <Route path="dono/visao-geral" element={<OwnerVisaoGeralPage />} />
        <Route path="dono/cadastro-aluno" element={<OwnerCadastroAlunoPage />} />
        <Route path="dono/alunos" element={<OwnerAlunosPage />} />
        <Route path="dono/cadastro-treino" element={<OwnerCadastroTreinoPage />} />
        <Route path="dono/planos" element={<OwnerPlanosPage />} />
        <Route path="dono/contas-a-receber" element={<OwnerContasReceberPage />} />
        <Route path="dono/contas-a-pagar" element={<Navigate to="/dono/contas-a-receber" replace />} />
      </Route>

      <Route element={<DevLayout />}>
        <Route path="dev/visao-geral" element={<DevVisaoGeralPage />} />
        <Route path="dev/cadastro-academias" element={<DevCadastroAcademiasPage />} />
        <Route path="dev/donos-academias" element={<DevDonosAcademiasPage />} />
        <Route path="dev/contas-a-receber" element={<DevContasReceberPage />} />
      </Route>

      <Route path="/dashboard" element={<Navigate to="/dono/visao-geral" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
