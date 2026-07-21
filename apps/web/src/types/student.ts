import type { WorkoutSummary } from "./workout";

export interface StudentGoalMetric {
  id: string;
  label: string;
  atual: number;
  meta: number;
  unidade: string;
  status: "ativo" | "em_breve";
  direction?: "up" | "down";
}

export interface StudentOverview {
  aluno: {
    nomeCompleto: string;
    planoModalidade: string;
  };
  semana: {
    start: string;
    end: string;
  };
  treinosSemana: WorkoutSummary[];
  proximoTreino: WorkoutSummary | null;
  metas: StudentGoalMetric[];
}

export interface StudentBilling {
  planoModalidade: string;
  valorMensalidade: number;
  diaVencimento: string;
  proximoVencimento: string;
  proximoVencimentoLabel: string;
  formaPagamento: string | null;
  dataInicio: string;
  status: "em_dia" | "vencido" | "hoje";
}
