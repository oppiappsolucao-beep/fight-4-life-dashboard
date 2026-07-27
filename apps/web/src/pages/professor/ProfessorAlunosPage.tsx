import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";

interface ProfessorAlunoItem {
  id: string;
  nomeCompleto: string;
  planoModalidade: string;
  email: string;
  telefone: string | null;
  fotoUrl: string | null;
  dataInicio: string;
  modalityIds: string[];
  modalityNames: string[];
}

interface ModalityOption {
  id: string;
  name: string;
}

export default function ProfessorAlunosPage() {
  const [alunos, setAlunos] = useState<ProfessorAlunoItem[]>([]);
  const [modalidades, setModalidades] = useState<ModalityOption[]>([]);
  const [selectedModalityId, setSelectedModalityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch<{ alunos: ProfessorAlunoItem[]; modalidades: ModalityOption[] }>("/professor/alunos")
      .then((data) => {
        setAlunos(data.alunos);
        setModalidades(data.modalidades);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar alunos."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredAlunos = useMemo(() => {
    if (!selectedModalityId) return alunos;
    return alunos.filter((item) => item.modalityIds.includes(selectedModalityId));
  }, [alunos, selectedModalityId]);

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-white">Alunos</h1>
        <p className="mt-2 text-sm text-white/60">
          Alunos matriculados nas modalidades que você leciona.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando alunos...
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-white">Suas modalidades</h2>
                <p className="mt-1 text-sm text-white/45">
                  {filteredAlunos.length} aluno{filteredAlunos.length === 1 ? "" : "s"} encontrado(s)
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"
              >
                Atualizar
              </button>
            </div>

            {modalidades.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModalityId("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    !selectedModalityId
                      ? "bg-[#e85d6f] text-white"
                      : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                  }`}
                >
                  Todas
                </button>
                {modalidades.map((modality) => (
                  <button
                    key={modality.id}
                    type="button"
                    onClick={() => setSelectedModalityId(modality.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedModalityId === modality.id
                        ? "bg-[#e85d6f] text-white"
                        : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                    }`}
                  >
                    {modality.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-white/45">
                Nenhuma modalidade liberada para você.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
            {filteredAlunos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Nenhum aluno encontrado
                {selectedModalityId ? " nesta modalidade" : " nas suas modalidades"}.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlunos.map((aluno) => (
                  <article
                    key={aluno.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/25 p-4"
                  >
                    {aluno.fotoUrl ? (
                      <img
                        src={aluno.fotoUrl}
                        alt={aluno.nomeCompleto}
                        className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold text-white/70">
                        {aluno.nomeCompleto.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="m-0 font-semibold text-white">{aluno.nomeCompleto}</p>
                      <p className="m-0 mt-1 text-sm text-white/50">
                        Plano: {aluno.planoModalidade}
                      </p>
                      <p className="m-0 mt-1 text-xs text-white/40">
                        {aluno.modalityNames.join(" • ")}
                      </p>
                      <p className="m-0 mt-1 text-xs text-white/40">
                        {aluno.email}
                        {aluno.telefone ? ` • ${aluno.telefone}` : ""}
                      </p>
                    </div>
                    <Link
                      to="/professor/cadastro-treino"
                      state={{ studentId: aluno.id }}
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-[#e85d6f]/40 hover:text-white"
                    >
                      Montar treino
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
