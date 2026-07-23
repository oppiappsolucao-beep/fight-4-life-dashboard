import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import OwnerModalitySchedulePanel from "../../components/owner/OwnerModalitySchedulePanel";
import WeeklyScheduleGrid from "../../components/owner/WeeklyScheduleGrid";
import { apiFetch } from "../../lib/api";
import { formatTimeRange, type ScheduleGridEntry } from "../../lib/schedule";
import {
  contentTypeLabel,
  type ModalityItem,
  type ScheduleSlot,
} from "../../types/modality";
import OwnerSectionPage from "./OwnerSectionPage";

export default function OwnerModalidadesPage() {
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleSlot[]>>({});
  const [repeatsMonthlyDrafts, setRepeatsMonthlyDrafts] = useState<Record<string, boolean>>({});
  const [gradeProfessorEntries, setGradeProfessorEntries] = useState<ScheduleGridEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [newContentType, setNewContentType] = useState<"VIDEO_GALLERY" | "EXERCISE_CATALOG">(
    "VIDEO_GALLERY",
  );
  const [newDescription, setNewDescription] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<{ modalidades: ModalityItem[] }>("/owner/modalidades"),
      apiFetch<{
        modalidades: Array<{ id: string; name: string; scheduleSlots: ScheduleSlot[] }>;
        professores: Array<{
          modalityName: string;
          professorName: string;
          weekday: number;
          startTime: string;
          endTime: string;
        }>;
      }>("/owner/modalidades/grade"),
    ])
      .then(([modalidadesData, gradeData]) => {
        setModalidades(modalidadesData.modalidades);
        setSelectedIds(
          modalidadesData.modalidades.filter((item) => item.active).map((item) => item.id),
        );
        setScheduleDrafts(
          Object.fromEntries(
            modalidadesData.modalidades.map((item) => [
              item.id,
              item.scheduleSlots?.length ? item.scheduleSlots : [],
            ]),
          ),
        );
        setRepeatsMonthlyDrafts(
          Object.fromEntries(
            modalidadesData.modalidades.map((item) => [
              item.id,
              item.scheduleRepeatsMonthly ?? true,
            ]),
          ),
        );
        setGradeProfessorEntries(
          gradeData.professores.map((item) => ({
            weekday: item.weekday,
            startTime: item.startTime,
            endTime: item.endTime,
            label: item.modalityName,
            sublabel: item.professorName,
            tone: "professor" as const,
          })),
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar modalidades."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const galleryModalities = useMemo(
    () => modalidades.filter((item) => item.contentType === "VIDEO_GALLERY"),
    [modalidades],
  );

  const activeModalities = useMemo(
    () => modalidades.filter((item) => selectedIds.includes(item.id)),
    [modalidades, selectedIds],
  );

  const modalityGridEntries = useMemo<ScheduleGridEntry[]>(
    () =>
      activeModalities.flatMap((modality) =>
        (scheduleDrafts[modality.id] ?? []).map((slot) => ({
          ...slot,
          label: modality.name,
          sublabel: formatTimeRange(slot),
          tone: "modality" as const,
        })),
      ),
    [activeModalities, scheduleDrafts],
  );

  const combinedGridEntries = useMemo(
    () => [...modalityGridEntries, ...gradeProfessorEntries],
    [modalityGridEntries, gradeProfessorEntries],
  );

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setSuccess("");
  }

  async function handleCreateModality(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Informe o nome da modalidade.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/modalidades", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          contentType: newContentType,
          description: newDescription.trim() || undefined,
        }),
      });
      setSuccess(result.message);
      setNewName("");
      setNewDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar modalidade.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (selectedIds.length === 0) {
      setError("Selecione ao menos uma modalidade.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/modalidades/ofertadas", {
        method: "PUT",
        body: JSON.stringify({ modalityIds: selectedIds }),
      });
      setSuccess(result.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveModalitySchedule(modalityId: string) {
    setSavingScheduleId(modalityId);
    setError("");
    try {
      const result = await apiFetch<{ message: string }>(`/owner/modalidades/${modalityId}/horarios`, {
        method: "PUT",
        body: JSON.stringify({
          slots: scheduleDrafts[modalityId] ?? [],
          repeatsMonthly: repeatsMonthlyDrafts[modalityId] ?? true,
        }),
      });
      setSuccess(result.message);
      setEditingScheduleId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar horários.");
    } finally {
      setSavingScheduleId(null);
    }
  }

  return (
    <OwnerSectionPage
      title="Modalidades da Academia"
      description="Ative modalidades, cadastre novas opções e configure dias e horários da grade semanal."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando...
        </div>
      ) : (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <form
            onSubmit={handleCreateModality}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <p className="m-0 text-sm font-semibold text-white">Incluir nova modalidade</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.9fr]">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex.: Boxe, Funcional, Cross..."
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              />
              <select
                value={newContentType}
                onChange={(event) =>
                  setNewContentType(event.target.value as "VIDEO_GALLERY" | "EXERCISE_CATALOG")
                }
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              >
                <option value="VIDEO_GALLERY">Galeria de vídeos</option>
                <option value="EXERCISE_CATALOG">Catálogo de treinos</option>
              </select>
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Descrição opcional"
                rows={2}
                className="md:col-span-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="mt-4 rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating ? "Adicionando..." : "Adicionar modalidade"}
            </button>
          </form>

          <section className="grid gap-3 sm:grid-cols-2">
            {modalidades.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-[#e85d6f] bg-[#e85d6f]/10"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <p className="m-0 font-semibold text-white">{item.name}</p>
                  <p className="m-0 mt-1 text-xs text-white/50">{contentTypeLabel(item.contentType)}</p>
                  {item.description ? (
                    <p className="m-0 mt-2 text-sm text-white/55">{item.description}</p>
                  ) : null}
                  {(scheduleDrafts[item.id] ?? []).length > 0 ? (
                    <p className="m-0 mt-2 text-xs text-emerald-300">
                      {(scheduleDrafts[item.id] ?? []).length} horário(s) cadastrado(s)
                    </p>
                  ) : null}
                </button>
              );
            })}
          </section>

          <p className="text-sm text-white/45">
            Modalidades de vídeo ativas:{" "}
            {galleryModalities.filter((item) => selectedIds.includes(item.id)).length}
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar modalidades ofertadas"}
          </button>

          {activeModalities.length > 0 ? (
            <section className="space-y-3">
              <div>
                <p className="m-0 text-sm font-semibold text-white">Horários por modalidade</p>
                <p className="m-0 mt-1 text-xs text-white/45">
                  Edite uma modalidade por vez para manter a tela organizada.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeModalities.map((modality) => (
                  <button
                    key={modality.id}
                    type="button"
                    onClick={() =>
                      setEditingScheduleId((current) =>
                        current === modality.id ? null : modality.id,
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      editingScheduleId === modality.id
                        ? "bg-[#e85d6f] text-white"
                        : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                    }`}
                  >
                    {modality.name}
                    {(scheduleDrafts[modality.id] ?? []).length > 0
                      ? ` • ${(scheduleDrafts[modality.id] ?? []).length} horário(s)`
                      : ""}
                  </button>
                ))}
              </div>

              {editingScheduleId ? (
                (() => {
                  const modality = activeModalities.find((item) => item.id === editingScheduleId);
                  if (!modality) return null;
                  return (
                    <OwnerModalitySchedulePanel
                      modality={modality}
                      slots={scheduleDrafts[modality.id] ?? []}
                      repeatsMonthly={repeatsMonthlyDrafts[modality.id] ?? true}
                      saving={savingScheduleId === modality.id}
                      onSlotsChange={(slots) =>
                        setScheduleDrafts((current) => ({ ...current, [modality.id]: slots }))
                      }
                      onRepeatsMonthlyChange={(value) =>
                        setRepeatsMonthlyDrafts((current) => ({
                          ...current,
                          [modality.id]: value,
                        }))
                      }
                      onSave={() => saveModalitySchedule(modality.id)}
                      onClose={() => setEditingScheduleId(null)}
                    />
                  );
                })()
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                  Selecione uma modalidade acima para editar horários, repetição mensal e cancelamentos.
                </div>
              )}
            </section>
          ) : null}

          <WeeklyScheduleGrid
            title="Grade semanal da academia"
            entries={combinedGridEntries}
            emptyMessage="Ative modalidades e cadastre horários para montar a grade."
          />
        </div>
      )}
    </OwnerSectionPage>
  );
}
