import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";import LessonVideoUploadField from "../professor/LessonVideoUploadField";
import { apiFetch } from "../../lib/api";
import {
  WEEKDAY_LABELS,
  formatTimeRange,
  scheduleSlotKey,
  weekdayFromDateInput,
  type ScheduleSlot,
} from "../../lib/schedule";
import type { ModalityItem, ProfessorItem, ProfessorLessonItem } from "../../types/modality";

interface OwnerLessonCadastroPanelProps {
  modalidades: ModalityItem[];
  selectedModalityId: string;
  onModalityChange: (modalityId: string) => void;
  classDate: string;
  onClassDateChange: (value: string) => void;
  professores: ProfessorItem[];
}

const EMPTY_FORM = {
  professorId: "",
  title: "",
  description: "",
  videoUrl: "",
  startTime: "",
  endTime: "",
};

export default function OwnerLessonCadastroPanel({
  modalidades,
  selectedModalityId,
  onModalityChange,
  classDate,
  onClassDateChange,
  professores,
}: OwnerLessonCadastroPanelProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [aulas, setAulas] = useState<ProfessorLessonItem[]>([]);
  const [loadingAulas, setLoadingAulas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const loadAulasRequestRef = useRef(0);

  const selectedModality = modalidades.find((item) => item.id === selectedModalityId);
  const availableProfessors = useMemo(
    () =>
      professores.filter((professor) => {
        if (!professor.active) return false;
        if (!professor.modalityIds.includes(selectedModalityId)) return false;
        const stat = professor.modalityStats?.find((item) => item.modalityId === selectedModalityId);
        return stat?.assignmentActive ?? true;
      }),
    [professores, selectedModalityId],
  );

  const selectedProfessor = availableProfessors.find((item) => item.id === form.professorId);

  const weekday = useMemo(() => weekdayFromDateInput(classDate), [classDate]);

  const availableSlots = useMemo(() => {
    const professorSlots =
      selectedProfessor?.schedules.find((entry) => entry.modalityId === selectedModalityId)?.slots ??
      [];
    const modalitySlots = selectedModality?.scheduleSlots ?? [];
    const source = professorSlots.length > 0 ? professorSlots : modalitySlots;
    return source.filter((slot) => slot.weekday === weekday);
  }, [selectedProfessor, selectedModality, selectedModalityId, weekday]);

  const loadAulas = useCallback(() => {
    if (!selectedModalityId || !classDate) return;
    const requestId = ++loadAulasRequestRef.current;
    setLoadingAulas(true);
    apiFetch<{ aulas: ProfessorLessonItem[] }>(
      `/owner/aulas?modalityId=${encodeURIComponent(selectedModalityId)}&classDate=${encodeURIComponent(classDate)}`,
    )
      .then((data) => {
        if (requestId !== loadAulasRequestRef.current) return;
        setAulas(data.aulas);
      })
      .catch(() => {
        if (requestId !== loadAulasRequestRef.current) return;
        setAulas([]);
      })
      .finally(() => {
        if (requestId !== loadAulasRequestRef.current) return;
        setLoadingAulas(false);
      });
  }, [classDate, selectedModalityId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAulas();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadAulas]);
  useEffect(() => {
    setForm({
      ...EMPTY_FORM,
      professorId: availableProfessors[0]?.id ?? "",
    });
    setSelectedSlotKey("");
    setError("");
    setSuccess("");
  }, [selectedModalityId, availableProfessors]);

  useEffect(() => {
    setSelectedSlotKey("");
    setForm((current) => ({
      ...current,
      startTime: "",
      endTime: "",
    }));
  }, [form.professorId, classDate]);

  function selectSlot(slot: ScheduleSlot) {
    const key = scheduleSlotKey(slot);
    setSelectedSlotKey(key);
    setForm((current) => ({
      ...current,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedModalityId) {
      setError("Selecione a modalidade.");
      return;
    }
    if (!form.professorId) {
      setError("Selecione o professor.");
      return;
    }
    if (!form.title.trim()) {
      setError("Informe o título da aula.");
      return;
    }
    if (!form.videoUrl.trim()) {
      setError("Envie o vídeo do movimento ou informe a URL.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/aulas", {
        method: "POST",
        body: JSON.stringify({
          modalityId: selectedModalityId,
          professorId: form.professorId,
          classDate,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          startTime: form.startTime || undefined,
          endTime: form.endTime || undefined,
          videoUrl: form.videoUrl,
        }),
      });
      setSuccess(result.message);
      setForm({
        ...EMPTY_FORM,
        professorId: form.professorId,
      });
      setSelectedSlotKey("");
      loadAulas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao publicar aula.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Modalidade
          </label>
          <select
            value={selectedModalityId}
            onChange={(event) => onModalityChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C] outline-none focus:border-[#5B7595]/60"
            required
          >
            {modalidades
              .filter((item) => item.active && item.contentType !== "EXERCISE_CATALOG")
              .map((modality) => (
                <option key={modality.id} value={modality.id} className="bg-zinc-900">
                  {modality.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Data da aula
          </label>
          <input
            type="date"
            value={classDate}
            onChange={(event) => onClassDateChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C] outline-none focus:border-[#5B7595]/60"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <p className="m-0 text-sm text-slate-500">
            Cadastre a aula em vídeo do dia para a modalidade{" "}
            <strong className="text-[#2E496C]">{selectedModality?.name ?? "—"}</strong>. Os alunos
            visualizam na galeria e marcam presença.
          </p>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 xl:grid-cols-[1fr_0.95fr]"
      >
        <div className="space-y-4">
          <p className="m-0 text-sm font-semibold text-[#2E496C]">Publicar aula do professor</p>

          <label className="block text-xs text-slate-500">
            Professor
            <select
              value={form.professorId}
              onChange={(event) =>
                setForm((current) => ({ ...current, professorId: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
              required
            >
              {availableProfessors.length === 0 ? (
                <option value="">Cadastre o professor em Professores</option>
              ) : (
                availableProfessors.map((professor) => (
                  <option key={professor.id} value={professor.id}>
                    {professor.name ?? professor.email}
                  </option>
                ))
              )}
            </select>
          </label>

          <div>
            <p className="m-0 text-xs text-slate-500">
              Horário — {WEEKDAY_LABELS[weekday]}
            </p>
            {availableSlots.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {availableSlots.map((slot) => {
                  const key = scheduleSlotKey(slot);
                  const selected = selectedSlotKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectSlot(slot)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selected
                          ? "bg-emerald-500/25 text-emerald-700 ring-1 ring-emerald-400/40"
                          : "border border-slate-200 text-[#2E496C]/65"
                      }`}
                    >
                      {formatTimeRange(slot)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 mt-2 text-xs text-amber-800/80">
                Nenhum horário cadastrado para este dia. Informe manualmente abaixo ou configure em
                Professores / Modalidades.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-500">
              Início
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => {
                  setSelectedSlotKey("");
                  setForm((current) => ({ ...current, startTime: event.target.value }));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Fim
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => {
                  setSelectedSlotKey("");
                  setForm((current) => ({ ...current, endTime: event.target.value }));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-500">
            Título da aula
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex.: Passagem de guarda"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
              required
            />
          </label>

          <label className="block text-xs text-slate-500">
            Descrição do movimento
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              placeholder="Explique o movimento, detalhes e observações..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
            />
          </label>

          <LessonVideoUploadField
            onChange={(videoUrl) => setForm((current) => ({ ...current, videoUrl }))}
          />

          <label className="block text-xs text-slate-500">
            URL do vídeo (opcional se fez upload)
            <input
              value={form.videoUrl.startsWith("data:") ? "" : form.videoUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, videoUrl: event.target.value }))
              }
              placeholder="https://youtube.com/..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#2E496C]"
            />
          </label>
          {form.videoUrl.startsWith("data:") ? (
            <p className="m-0 text-xs text-emerald-700">Vídeo carregado para envio.</p>
          ) : null}

          <button
            type="submit"
            disabled={saving || availableProfessors.length === 0}
            className="rounded-lg bg-[#5B7595] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2E496C] disabled:opacity-60"
          >
            {saving ? "Publicando..." : "Publicar aula"}
          </button>
        </div>

        <div className="space-y-3">
          <p className="m-0 text-sm font-semibold text-[#2E496C]">
            Aulas do dia ({loadingAulas ? "..." : aulas.length})
          </p>
          {loadingAulas ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
              Carregando aulas...
            </div>
          ) : aulas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Nenhuma aula publicada para esta data.
            </div>
          ) : (
            aulas.map((aula) => (
              <article key={aula.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="m-0 font-semibold text-[#2E496C]">{aula.title}</p>
                <p className="m-0 mt-1 text-sm text-slate-500">
                  {aula.professor?.name ?? aula.professor?.email ?? "Professor"}
                  {aula.startTime && aula.endTime
                    ? ` • ${aula.startTime} – ${aula.endTime}`
                    : ""}
                  {" • "}
                  {aula.attendanceCount} presença(s)
                </p>
                {aula.description ? (
                  <p className="m-0 mt-2 text-sm text-slate-500">{aula.description}</p>
                ) : null}
                <p
                  className={`m-0 mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    aula.active
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-red-500/15 text-red-700"
                  }`}
                >
                  {aula.active ? "Ativa" : "Bloqueada"}
                </p>
              </article>
            ))
          )}
        </div>
      </form>
    </div>
  );
}
