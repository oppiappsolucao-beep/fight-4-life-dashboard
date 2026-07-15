import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { formatCpf, formatPhone } from "../../lib/format";
import OwnerSectionPage from "./OwnerSectionPage";

interface AlunoListItem {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string | null;
  planoModalidade: string;
  dataInicio: string;
  diaVencimento: string;
  formaPagamento: string | null;
  fotoUrl: string | null;
  createdAt: string;
}

function formatCpfDisplay(cpf: string): string {
  return formatCpf(cpf);
}

export default function OwnerAlunosPage() {
  const [alunos, setAlunos] = useState<AlunoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<{ alunos: AlunoListItem[] }>("/owner/alunos")
      .then((data) => setAlunos(data.alunos))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar alunos."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <OwnerSectionPage
      title="Alunos"
      description="Visualize e gerencie todos os alunos cadastrados na academia."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {loading ? "Carregando…" : `${alunos.length} aluno(s) cadastrado(s)`}
        </p>
        <Link
          to="/dono/cadastro-aluno"
          className="rounded-lg bg-[#e85d6f] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#d44d5f]"
        >
          Novo aluno
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && alunos.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Nenhum aluno cadastrado ainda.
          </p>
          <Link
            to="/dono/cadastro-aluno"
            className="mt-4 inline-block text-sm font-medium text-[#e85d6f] no-underline hover:underline"
          >
            Cadastrar primeiro aluno
          </Link>
        </div>
      ) : null}

      {alunos.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[0.7rem] uppercase tracking-wide text-white/45">
                <th className="px-4 py-3 font-medium">Aluno</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Venc.</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((aluno) => (
                <tr
                  key={aluno.id}
                  className="border-b border-white/5 text-white/85 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {aluno.fotoUrl ? (
                        <img
                          src={aluno.fotoUrl}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60">
                          {aluno.nomeCompleto.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="m-0 font-medium text-white">
                          {aluno.nomeCompleto}
                        </p>
                        <p className="m-0 text-xs text-white/45">{aluno.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    {formatCpfDisplay(aluno.cpf)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    {aluno.telefone ? formatPhone(aluno.telefone) : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {aluno.planoModalidade}
                    {aluno.formaPagamento ? (
                      <span className="block text-xs text-white/40">
                        {aluno.formaPagamento}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    {aluno.dataInicio}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    Dia {aluno.diaVencimento}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </OwnerSectionPage>
  );
}
