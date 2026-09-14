import { FormEvent, useCallback, useEffect, useState } from "react";
import LessonVideoUploadField from "../../components/professor/LessonVideoUploadField";
import { apiFetch } from "../../lib/api";
import { todayDateInputValue } from "../../lib/workout";
import type { ModalityItem, ProfessorLessonItem } from "../../types/modality";

const EMPTY = {
  modalityId: "",
  title: "",
  description: "",
  classDate: todayDateInputValue(),
  videoUrl: "",
};

export default function ProfessorAulasPage() {
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [aulas, setAulas] = useState<ProfessorLessonItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [presencas, setPresencas] = useState<
    Array<{ id: string; markedAt: string; student: { id: string; nomeCompleto: string } }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<{ modalidades: ModalityItem[] }>("/professor/modalidades"),
      apiFetch<{ aulas: ProfessorLessonItem[] }>("/professor/aulas"),
    ])
      .then(([modData, aulaData]) => {
        setModalidades(modData.modalidades);
        setAulas(aulaData.aulas);
        setForm((current) => ({
          ...current,
          modalityId: current.modalityId || modData.modalidades[0]?.id || "",
        }));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar aulas."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadPresencas(lessonId: string) {
    setSelectedLessonId(lessonId);
    const data = await apiFetch<{
      presencas: Array<{
        id: string;
        markedAt: string;
        student: { id: string; nomeCompleto: string; planoModalidade: string };
      }>;
    }>(`/professor/aulas/${lessonId}/presencas`);
    setPresencas(data.presencas);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.videoUrl.trim()) {
      setError("Envie um vídeo ou informe a URL.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/professor/aulas", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(result.message);
      setForm({ ...EMPTY, modalityId: form.modalityId });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao publicar aula.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 md:px-10 md:py-8">
      <header className="mb-6">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#5B7595]">
          Professor
        </p>
        <h1 className="m-0 text-2xl font-semibold text-[#2E496C]">Minhas Aulas</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cadastre a data, título, descrição e vídeo do movimento para suas modalidades liberadas.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : modalidades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          Nenhuma modalidade liberada. Peça ao dono da academia para liberar seu acesso.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <section className="space-y-3">
            <p className="m-0 text-sm font-semibold text-[#2E496C]">Aulas publicadas ({aulas.length})</p>
            {aulas.map((aula) => (
              <article key={aula.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="m-0 font-semibold text-[#2E496C]">{aula.title}</p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  {aula.modality?.name} • {aula.classDate} • {aula.attendanceCount} presença(s)
                </p>
                {aula.description ? (
                  <p className="m-0 mt-2 text-sm text-slate-500">{aula.description}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => loadPresencas(aula.id)}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                >
                  Ver presenças
                </button>
              </article>
            ))}

            {selectedLessonId ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="m-0 text-sm font-semibold text-[#2E496C]">Alunos presentes</p>
                {presencas.length === 0 ? (
                  <p className="m-0 mt-2 text-sm text-slate-400">Nenhuma presença marcada ainda.</p>
                ) : (
                  <ul className="m-0 mt-3 space-y-2 p-0">
                    {presencas.map((item) => (
                      <li
                        key={item.id}
                        className="list-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                      >
                        {item.student.nomeCompleto}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="m-0 text-sm font-semibold text-[#2E496C]">Nova aula</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate-500">
                Modalidade
                <select
                  value={form.modalityId}
                  onChange={(e) => setForm((c) => ({ ...c, modalityId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                  required
                >
                  {modalidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Data da aula
                <input
                  type="date"
                  value={form.classDate}
                  onChange={(e) => setForm((c) => ({ ...c, classDate: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                  required
                />
              </label>
              <label className="block text-xs text-slate-500">
                Título
                <input
                  value={form.title}
                  onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                  required
                />
              </label>
              <label className="block text-xs text-slate-500">
                Descrição
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                />
              </label>
              <LessonVideoUploadField onChange={(videoUrl) => setForm((c) => ({ ...c, videoUrl }))} />
              <label className="block text-xs text-slate-500">
                URL do vídeo (opcional se fez upload)
                <input
                  value={form.videoUrl.startsWith("data:") ? "" : form.videoUrl}
                  onChange={(e) => setForm((c) => ({ ...c, videoUrl: e.target.value }))}
                  placeholder="https://youtube.com/..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
                />
              </label>
              {form.videoUrl.startsWith("data:") ? (
                <p className="m-0 text-xs text-emerald-700">Vídeo carregado para envio.</p>
              ) : null}
            </div>
            {error ? (
              <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-[#5B7595] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Publicando..." : "Publicar aula"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
