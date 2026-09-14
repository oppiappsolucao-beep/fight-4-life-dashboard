import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { formatCpf, formatPhone } from "../../lib/format";
import OwnerAlunoEditModal from "../../components/owner/OwnerAlunoEditModal";
import { resolveMediaUrl } from "../../lib/mediaUrl";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(aluno: AlunoListItem) {
    const confirmed = window.confirm(
      `Deseja remover ${aluno.nomeCompleto}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setDeletingId(aluno.id);
    setError("");
    try {
      await apiFetch(`/owner/alunos/${aluno.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover aluno.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <OwnerSectionPage
      title="Alunos"
      description="Visualize e gerencie todos os alunos cadastrados na academia."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {loading ? "Carregando…" : `${alunos.length} aluno(s) cadastrado(s)`}
        </p>
        <Link
          to="/dono/cadastro-aluno"
          className="rounded-lg bg-[#5B7595] px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-[#2E496C]"
        >
          Novo aluno
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && alunos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-slate-500">
            Nenhum aluno cadastrado ainda.
          </p>
          <Link
            to="/dono/cadastro-aluno"
            className="mt-4 inline-block text-sm font-medium text-[#5B7595] no-underline hover:underline"
          >
            Cadastrar primeiro aluno
          </Link>
        </div>
      ) : null}

      {alunos.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white backdrop-blur-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[0.7rem] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Aluno</th>
                <th className="px-4 py-3 font-medium">CPF</th>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Venc.</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((aluno) => (
                <tr
                  key={aluno.id}
                  className="border-b border-slate-100 text-[#2E496C]/85 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {resolveMediaUrl(aluno.fotoUrl) ? (
                        <img
                          src={resolveMediaUrl(aluno.fotoUrl)!}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-slate-500">
                          {aluno.nomeCompleto.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="m-0 font-medium text-[#2E496C]">
                          {aluno.nomeCompleto}
                        </p>
                        <p className="m-0 text-xs text-slate-400">{aluno.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatCpfDisplay(aluno.cpf)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {aluno.telefone ? formatPhone(aluno.telefone) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {aluno.planoModalidade}
                    {aluno.formaPagamento ? (
                      <span className="block text-xs text-[#2E496C]/40">
                        {aluno.formaPagamento}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {aluno.dataInicio}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    Dia {aluno.diaVencimento}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(aluno.id)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-[#5B7595]/50 hover:text-[#2E496C]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === aluno.id}
                        onClick={() => void handleDelete(aluno)}
                        className="rounded-md border border-red-400/25 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {deletingId === aluno.id ? "Removendo..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editingId ? (
        <OwnerAlunoEditModal
          alunoId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={load}
        />
      ) : null}
    </OwnerSectionPage>
  );
}
