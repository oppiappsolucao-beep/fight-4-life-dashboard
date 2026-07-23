import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModalitySchedulePicker from "../../components/owner/ModalitySchedulePicker";
import WeeklyScheduleGrid from "../../components/owner/WeeklyScheduleGrid";
import { apiFetch } from "../../lib/api";
import { buildModalityColorMap, type ScheduleGridEntry } from "../../lib/schedule";
import type { ModalityItem, ProfessorItem, ScheduleSlot } from "../../types/modality";
import OwnerSectionPage from "./OwnerSectionPage";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  modalityIds: [] as string[],
};

export default function OwnerProfessoresPage() {
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSchedules, setFormSchedules] = useState<Record<string, ScheduleSlot[]>>({});
  const [formEditingModalityId, setFormEditingModalityId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingProfessorId, setEditingProfessorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingProfessorId, setUpdatingProfessorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const cadastroFormRef = useRef<HTMLFormElement>(null);

  const activeModalities = useMemo(
    () => modalidades.filter((item) => item.active),
    [modalidades],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<{ professores: ProfessorItem[] }>("/owner/professores"),
      apiFetch<{ modalidades: ModalityItem[] }>("/owner/modalidades"),
    ])
      .then(([profData, modData]) => {
        setProfessores(profData.professores);
        setModalidades(modData.modalidades);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar professores."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modalityColorMap = useMemo(
    () => buildModalityColorMap(activeModalities.map((item) => item.id)),
    [activeModalities],
  );

  const professorGridEntries = useMemo<ScheduleGridEntry[]>(
    () =>
      professores.flatMap((professor) =>
        (professor.schedules ?? []).flatMap((entry) => {
          const modality = activeModalities.find((item) => item.id === entry.modalityId);
          const modalityName = modality?.name ?? "Modalidade";
          return entry.slots.map((slot) => ({
            ...slot,
            modalityId: entry.modalityId,
            label: modalityName,
            sublabel: professor.name ?? professor.email,
            tone: "professor" as const,
            colorClass: modality ? modalityColorMap[modality.id] : undefined,
          }));
        }),
      ),
    [professores, activeModalities, modalityColorMap],
  );

  const selectedViewModality = activeModalities.find((item) => item.id === formEditingModalityId);

  const filteredProfessores = useMemo(() => {
    if (!formEditingModalityId) return [];
    return professores.filter((professor) =>
      professor.modalityIds.includes(formEditingModalityId),
    );
  }, [professores, formEditingModalityId]);

  function buildSchedulesPayload(source: Record<string, ScheduleSlot[]>, modalityIds: string[]) {
    return modalityIds
      .filter((modalityId) => (source[modalityId] ?? []).length > 0)
      .map((modalityId) => ({
        modalityId,
        slots: source[modalityId] ?? [],
      }));
  }

  function resolveFormModalityIds(
    modalityIds: string[],
    schedules: Record<string, ScheduleSlot[]>,
  ) {
    return modalityIds.filter((modalityId) => (schedules[modalityId] ?? []).length > 0);
  }

  function syncFormModalityFromSchedules(modalityId: string, slots: ScheduleSlot[]) {
    setFormSchedules((current) => ({ ...current, [modalityId]: slots }));
    setForm((current) => ({
      ...current,
      modalityIds:
        slots.length > 0
          ? current.modalityIds.includes(modalityId)
            ? current.modalityIds
            : [...current.modalityIds, modalityId]
          : current.modalityIds.filter((item) => item !== modalityId),
    }));
  }

  function resetCreateForm() {
    setFormMode("create");
    setEditingProfessorId(null);
    setForm(EMPTY_FORM);
    setFormSchedules({});
    setFormEditingModalityId(null);
  }

  function openProfessorCadastro(professor: ProfessorItem) {
    const schedulesMap = Object.fromEntries(
      (professor.schedules ?? []).map((entry) => [entry.modalityId, entry.slots]),
    );
    const modalityIds = professor.modalityIds.filter(
      (id) => (schedulesMap[id] ?? []).length > 0,
    );

    setFormMode("edit");
    setEditingProfessorId(professor.id);
    setForm({
      name: professor.name ?? "",
      email: professor.email,
      password: "",
      modalityIds,
    });
    setFormSchedules(schedulesMap);
    setFormEditingModalityId(modalityIds[0] ?? null);
    cadastroFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectFormModality(id: string) {
    setFormEditingModalityId((current) => (current === id ? null : id));
    setSuccess("");
  }

  async function handleSubmitProfessor(event: FormEvent) {
    event.preventDefault();

    const modalityIds = resolveFormModalityIds(form.modalityIds, formSchedules);
    if (modalityIds.length === 0) {
      setError("Selecione ao menos uma modalidade com horários.");
      return;
    }

    const schedules = buildSchedulesPayload(formSchedules, modalityIds);

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (formMode === "create") {
        const result = await apiFetch<{ message: string }>("/owner/professores", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            modalityIds,
            schedules,
          }),
        });
        setSuccess(result.message);
        resetCreateForm();
      } else if (editingProfessorId) {
        await updateProfessor(
          editingProfessorId,
          {
            name: form.name.trim(),
            ...(form.password ? { password: form.password } : {}),
            modalityIds,
            schedules,
          },
          "Ficha do professor atualizada.",
        );
        resetCreateForm();
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar professor.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProfessor(
    professorId: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setUpdatingProfessorId(professorId);
    setError("");
    try {
      await apiFetch(`/owner/professores/${professorId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSuccess(successMessage);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar professor.");
    } finally {
      setUpdatingProfessorId(null);
    }
  }

  async function toggleProfessorAccess(professor: ProfessorItem) {
    await updateProfessor(
      professor.id,
      { active: !professor.active },
      professor.active ? "Professor desabilitado." : "Professor habilitado.",
    );
  }

  return (
    <OwnerSectionPage
      title="Professores"
      description="Gerencie professores, modalidades e horários da grade."
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
            ref={cadastroFormRef}
            onSubmit={handleSubmitProfessor}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-sm font-semibold text-white">
                {formMode === "create" ? "Cadastrar professor" : "Ficha do professor"}
              </p>
              {formMode === "edit" ? (
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70"
                >
                  Novo cadastro
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs text-white/50">
                Nome completo
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nome do professor"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required
                />
              </label>
              <label className="block text-xs text-white/50">
                E-mail (usuário de acesso)
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="professor@academia.com"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required
                  readOnly={formMode === "edit"}
                />
              </label>
              <label className="block text-xs text-white/50">
                {formMode === "edit" ? "Nova senha (opcional)" : "Senha de acesso"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder={formMode === "edit" ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required={formMode === "create"}
                />
              </label>
              <div>
                <p className="m-0 mb-2 text-xs text-white/50">Modalidades que leciona</p>
                <div className="flex flex-wrap gap-2">
                  {activeModalities.map((item) => {
                    const slotCount = (formSchedules[item.id] ?? []).length;
                    const selected = slotCount > 0;
                    const editing = formEditingModalityId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectFormModality(item.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          editing
                            ? "bg-[#e85d6f] text-white ring-2 ring-[#e85d6f]/40"
                            : selected
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "border border-white/15 text-white/60"
                        }`}
                      >
                        {item.name}
                        {selected ? ` • ${slotCount} horário(s)` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {formEditingModalityId ? (
                (() => {
                  const modality = activeModalities.find(
                    (item) => item.id === formEditingModalityId,
                  );
                  if (!modality) return null;
                  return (
                    <ModalitySchedulePicker
                      modality={modality}
                      selectedSlots={formSchedules[formEditingModalityId] ?? []}
                      onChange={(slots) => syncFormModalityFromSchedules(formEditingModalityId, slots)}
                    />
                  );
                })()
              ) : (
                <p className="m-0 text-xs text-white/45">
                  Clique em uma modalidade para escolher os horários. Só entram no cadastro as que
                  tiverem horário selecionado.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : formMode === "create"
                  ? "Cadastrar professor"
                  : "Salvar ficha"}
            </button>
          </form>

          {formEditingModalityId && selectedViewModality ? (
            <>
              <section className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="m-0 text-sm font-semibold text-white">
                    Professores — {selectedViewModality.name} ({filteredProfessores.length})
                  </p>
                </div>
                {filteredProfessores.length === 0 ? (
                  <p className="m-0 py-4 text-center text-sm text-white/45">
                    Nenhum professor cadastrado nesta modalidade.
                  </p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {filteredProfessores.map((professor) => (
                      <div
                        key={professor.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-medium text-white">
                            {professor.name ?? professor.email}
                          </p>
                          <p className="m-0 truncate text-[0.65rem] text-white/40">
                            {professor.email}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingProfessorId === professor.id}
                            onClick={() => openProfessorCadastro(professor)}
                            className="rounded-lg border border-white/15 px-2.5 py-1 text-[0.65rem] font-semibold text-white/75"
                          >
                            Cadastro
                          </button>
                          <button
                            type="button"
                            disabled={updatingProfessorId === professor.id}
                            onClick={() => toggleProfessorAccess(professor)}
                            className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold ${
                              professor.active
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "border border-white/15 text-white/45"
                            }`}
                          >
                            {professor.active ? "Habilitado" : "Desabilitado"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <WeeklyScheduleGrid
                title={`Grade — ${selectedViewModality.name}`}
                entries={professorGridEntries}
                emptyMessage="Cadastre professores com horários nesta modalidade para montar a grade."
                filterModalityId={formEditingModalityId}
                filterLabel={selectedViewModality.name}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
              Selecione uma modalidade acima para ver os professores e a grade de horários.
            </div>
          )}
        </div>
      )}
    </OwnerSectionPage>
  );
}
