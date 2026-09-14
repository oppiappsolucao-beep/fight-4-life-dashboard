import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { resolveMediaUrl } from "../../lib/mediaUrl";

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
    apiFetch<{ alunos: ProfessorAlunoItem[]; modalidades: ModalityOption[] }>(
      "/professor/alunos?withFoto=1",
    )
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
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#A9BBD5]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-[#2E496C]">Alunos</h1>
        <p className="mt-2 text-sm text-slate-500">
          Alunos matriculados nas modalidades que você leciona.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando alunos...
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="m-0 text-base font-semibold text-[#2E496C]">Suas modalidades</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {filteredAlunos.length} aluno{filteredAlunos.length === 1 ? "" : "s"} encontrado(s)
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:border-[#5B7595]/50 hover:text-[#2E496C]"
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
                      ? "bg-[#5B7595] text-white"
                      : "border border-slate-200 text-slate-600 hover:border-[#5B7595]/50"
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
                        ? "bg-[#5B7595] text-white"
                        : "border border-slate-200 text-slate-600 hover:border-[#5B7595]/50"
                    }`}
                  >
                    {modality.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-slate-400">
                Nenhuma modalidade liberada para você.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            {filteredAlunos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                Nenhum aluno encontrado
                {selectedModalityId ? " nesta modalidade" : " nas suas modalidades"}.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlunos.map((aluno) => (
                  <article
                    key={aluno.id}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-[#123055]/55 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {resolveMediaUrl(aluno.fotoUrl) ? (
                        <img
                          src={resolveMediaUrl(aluno.fotoUrl)!}
                          alt={aluno.nomeCompleto}
                          className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#5B7595]/20 text-lg font-semibold text-[#A9BBD5]">
                          {aluno.nomeCompleto.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="m-0 break-words text-base font-semibold leading-snug text-[#2E496C]">
                          {aluno.nomeCompleto}
                        </p>
                        <p className="m-0 mt-1 break-words text-sm text-slate-500">
                          Plano: {aluno.planoModalidade}
                        </p>
                        {aluno.modalityNames.length > 0 ? (
                          <p className="m-0 mt-1 break-words text-xs text-[#2E496C]/40">
                            {aluno.modalityNames.join(" • ")}
                          </p>
                        ) : null}
                        <p className="m-0 mt-2 break-all text-xs text-slate-400">{aluno.email}</p>
                        {aluno.telefone ? (
                          <p className="m-0 mt-0.5 whitespace-nowrap text-xs text-slate-400">
                            {aluno.telefone}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      to="/professor/cadastro-treino"
                      state={{ studentId: aluno.id }}
                      className="inline-flex w-full shrink-0 items-center justify-center rounded-xl border border-[#5B7595]/40 bg-[#5B7595]/15 px-4 py-2.5 text-sm font-semibold text-[#d6e9f7] transition hover:bg-[#5B7595]/25 sm:w-auto"
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
