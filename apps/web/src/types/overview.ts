export interface OverviewGoalMetric {
  id: string;
  label: string;
  atual: number;
  meta: number;
  unidade: string;
  status: "ativo" | "em_breve";
  /** "down" = quanto menor, melhor (ex.: inadimplência, churn) */
  direction?: "up" | "down";
}

export interface OwnerOverview {
  tenant: { name: string };
  user: { name: string | null };
  semana: { start: string; end: string };
  metrics: {
    totalAlunos: number;
    treinosPublicados: number;
    treinosSemana: number;
    receitaPrevista: number;
    vencidos: number;
    venceHoje: number;
  };
  recentAlunos: Array<{
    id: string;
    nomeCompleto: string;
    planoModalidade: string;
    createdAt: string;
  }>;
  metas: OverviewGoalMetric[];
}

export interface ProfessorOverview {
  tenant: { name: string };
  user: { name: string | null };
  mes: { start: string; end: string; label: string };
  semana: { start: string; end: string };
  metrics: {
    totalAlunos: number;
    modalidadesAtivas: number;
    aulasMes: number;
    presencasPendentes: number;
    presencasValidadasMes: number;
  };
  modalidades: Array<{
    id: string;
    name: string;
    contentType: "EXERCISE_CATALOG" | "VIDEO_GALLERY";
    alunos: number;
    aulasMes: number;
  }>;
}

export interface DevOverview {
  user: { name: string | null };
  metrics: {
    totalAcademias: number;
    academiasAtivas: number;
    academiasInativas: number;
    donosCadastrados: number;
    receitaPlataforma: number;
  };
  recentAcademias: Array<{
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    billing: {
      plano: string;
      periodo: string;
      formaPagamento: string;
    };
    ownerEmail: string | null;
  }>;
  metas: OverviewGoalMetric[];
}
