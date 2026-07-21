import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import LessonVideoUploadField from "../professor/LessonVideoUploadField";
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
    setLoadingAulas(true);
    apiFetch<{ aulas: ProfessorLessonItem[] }>(
      `/owner/aulas?modalityId=${encodeURIComponent(selectedModalityId)}&classDate=${encodeURIComponent(classDate)}`,
    )
      .then((data) => setAulas(data.aulas))
      .catch(() => setAulas([]))
      .finally(() => setLoadingAulas(false));
  }, [classDate, selectedModalityId]);

  useEffect(() => {
    loadAulas();
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
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Modalidade
          </label>
          <select
            value={selectedModalityId}
            onChange={(event) => onModalityChange(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
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
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Data da aula
          </label>
          <input
            type="date"
            value={classDate}
            onChange={(event) => onClassDateChange(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <p className="m-0 text-sm text-white/55">
            Cadastre a aula em vídeo do dia para a modalidade{" "}
            <strong className="text-white">{selectedModality?.name ?? "—"}</strong>. Os alunos
            visualizam na galeria e marcam presença.
          </p>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-5 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 xl:grid-cols-[1fr_0.95fr]"
      >
        <div className="space-y-4">
          <p className="m-0 text-sm font-semibold text-white">Publicar aula do professor</p>

          <label className="block text-xs text-white/50">
            Professor
            <select
              value={form.professorId}
              onChange={(event) =>
                setForm((current) => ({ ...current, professorId: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
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
            <p className="m-0 text-xs text-white/50">
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
                          ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                          : "border border-white/15 text-white/65"
                      }`}
                    >
                      {formatTimeRange(slot)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 mt-2 text-xs text-amber-200/80">
                Nenhum horário cadastrado para este dia. Informe manualmente abaixo ou configure em
                Professores / Modalidades.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-white/50">
              Início
              <input
                type="time"
                value={form.startTime}
                onChange={(event) => {
                  setSelectedSlotKey("");
                  setForm((current) => ({ ...current, startTime: event.target.value }));
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-white/50">
              Fim
              <input
                type="time"
                value={form.endTime}
                onChange={(event) => {
                  setSelectedSlotKey("");
                  setForm((current) => ({ ...current, endTime: event.target.value }));
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              />
            </label>
          </div>

          <label className="block text-xs text-white/50">
            Título da aula
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex.: Passagem de guarda"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              required
            />
          </label>

          <label className="block text-xs text-white/50">
            Descrição do movimento
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              rows={4}
              placeholder="Explique o movimento, detalhes e observações..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
            />
          </label>

          <LessonVideoUploadField
            onChange={(videoUrl) => setForm((current) => ({ ...current, videoUrl }))}
          />

          <label className="block text-xs text-white/50">
            URL do vídeo (opcional se fez upload)
            <input
              value={form.videoUrl.startsWith("data:") ? "" : form.videoUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, videoUrl: event.target.value }))
              }
              placeholder="https://youtube.com/..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
            />
          </label>
          {form.videoUrl.startsWith("data:") ? (
            <p className="m-0 text-xs text-emerald-300">Vídeo carregado para envio.</p>
          ) : null}

          <button
            type="submit"
            disabled={saving || availableProfessors.length === 0}
            className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d44d5f] disabled:opacity-60"
          >
            {saving ? "Publicando..." : "Publicar aula"}
          </button>
        </div>

        <div className="space-y-3">
          <p className="m-0 text-sm font-semibold text-white">
            Aulas do dia ({loadingAulas ? "..." : aulas.length})
          </p>
          {loadingAulas ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/45">
              Carregando aulas...
            </div>
          ) : aulas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/45">
              Nenhuma aula publicada para esta data.
            </div>
          ) : (
            aulas.map((aula) => (
              <article key={aula.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <p className="m-0 font-semibold text-white">{aula.title}</p>
                <p className="m-0 mt-1 text-sm text-white/50">
                  {aula.professor?.name ?? aula.professor?.email ?? "Professor"}
                  {aula.startTime && aula.endTime
                    ? ` • ${aula.startTime} – ${aula.endTime}`
                    : ""}
                  {" • "}
                  {aula.attendanceCount} presença(s)
                </p>
                {aula.description ? (
                  <p className="m-0 mt-2 text-sm text-white/60">{aula.description}</p>
                ) : null}
                <p
                  className={`m-0 mt-2 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                    aula.active
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-red-500/15 text-red-200"
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
