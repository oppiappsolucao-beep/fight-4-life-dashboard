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
  const [professorScheduleDrafts, setProfessorScheduleDrafts] = useState<
    Record<string, Record<string, ScheduleSlot[]>>
  >({});
  const [professorEditingModalityId, setProfessorEditingModalityId] = useState<
    Record<string, string | null>
  >({});
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
        setProfessorScheduleDrafts(
          Object.fromEntries(
            profData.professores.map((professor) => [
              professor.id,
              Object.fromEntries(
                (professor.schedules ?? []).map((entry) => [entry.modalityId, entry.slots]),
              ),
            ]),
          ),
        );
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

  function buildSchedulesPayload(source: Record<string, ScheduleSlot[]>, modalityIds: string[]) {
    return modalityIds
      .filter((modalityId) => (source[modalityId] ?? []).length > 0)
      .map((modalityId) => ({
        modalityId,
        slots: source[modalityId] ?? [],
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
    setFormMode("edit");
    setEditingProfessorId(professor.id);
    setForm({
      name: professor.name ?? "",
      email: professor.email,
      password: "",
      modalityIds: [...professor.modalityIds],
    });
    setFormSchedules(
      Object.fromEntries(
        (professor.schedules ?? []).map((entry) => [entry.modalityId, entry.slots]),
      ),
    );
    setFormEditingModalityId(professor.modalityIds[0] ?? null);
    cadastroFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleFormModality(id: string) {
    setForm((current) => {
      const selected = current.modalityIds.includes(id);
      const modalityIds = selected
        ? current.modalityIds.filter((item) => item !== id)
        : [...current.modalityIds, id];

      if (selected) {
        setFormSchedules((schedules) => {
          const next = { ...schedules };
          delete next[id];
          return next;
        });
        setFormEditingModalityId((currentEditing) => (currentEditing === id ? null : currentEditing));
      } else {
        setFormEditingModalityId(id);
      }

      return { ...current, modalityIds };
    });
    setSuccess("");
  }

  async function handleSubmitProfessor(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (formMode === "create") {
        const result = await apiFetch<{ message: string }>("/owner/professores", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            schedules: buildSchedulesPayload(formSchedules, form.modalityIds),
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
            modalityIds: form.modalityIds,
            schedules: buildSchedulesPayload(formSchedules, form.modalityIds),
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
      professor.active ? "Acesso do professor bloqueado." : "Acesso do professor liberado.",
    );
  }

  async function toggleProfessorModality(professor: ProfessorItem, modalityId: string) {
    const enabled = professor.modalityIds.includes(modalityId);
    const drafts = professorScheduleDrafts[professor.id] ?? {};

    if (enabled) {
      const nextModalityIds = professor.modalityIds.filter((id) => id !== modalityId);
      const nextDrafts = { ...drafts };
      delete nextDrafts[modalityId];
      setProfessorScheduleDrafts((current) => ({
        ...current,
        [professor.id]: nextDrafts,
      }));
      setProfessorEditingModalityId((current) => ({
        ...current,
        [professor.id]: current[professor.id] === modalityId ? null : current[professor.id],
      }));
      await updateProfessor(
        professor.id,
        {
          modalityIds: nextModalityIds,
          schedules: buildSchedulesPayload(nextDrafts, nextModalityIds),
        },
        "Modalidade desativada para o professor.",
      );
      return;
    }

    const nextModalityIds = [...professor.modalityIds, modalityId];
    setProfessorEditingModalityId((current) => ({
      ...current,
      [professor.id]: modalityId,
    }));
    await updateProfessor(
      professor.id,
      {
        modalityIds: nextModalityIds,
        schedules: buildSchedulesPayload(drafts, nextModalityIds),
      },
      "Modalidade ativada — escolha os horários.",
    );
  }

  async function saveProfessorSchedule(professor: ProfessorItem) {
    const drafts = professorScheduleDrafts[professor.id] ?? {};
    await updateProfessor(
      professor.id,
      {
        modalityIds: professor.modalityIds,
        schedules: buildSchedulesPayload(drafts, professor.modalityIds),
      },
      "Horários do professor atualizados.",
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

          <section className="space-y-3">
            <p className="m-0 text-sm font-semibold text-white">
              Professores cadastrados ({professores.length})
            </p>
            {professores.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Nenhum professor cadastrado.
              </div>
            ) : (
              professores.map((professor) => {
                const editingModalityId = professorEditingModalityId[professor.id] ?? null;
                const drafts = professorScheduleDrafts[professor.id] ?? {};

                return (
                  <article
                    key={professor.id}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 font-semibold text-white">
                          {professor.name ?? professor.email}
                        </p>
                        <p className="m-0 mt-1 text-sm text-white/50">Usuário: {professor.email}</p>
                        <p
                          className={`m-0 mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            professor.active
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-red-500/15 text-red-200"
                          }`}
                        >
                          {professor.active ? "Acesso ativo" : "Acesso bloqueado"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={updatingProfessorId === professor.id}
                          onClick={() => openProfessorCadastro(professor)}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
                        >
                          Cadastro
                        </button>
                        <button
                          type="button"
                          disabled={updatingProfessorId === professor.id}
                          onClick={() => toggleProfessorAccess(professor)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                            professor.active
                              ? "border border-red-400/30 text-red-200"
                              : "border border-emerald-400/30 text-emerald-200"
                          }`}
                        >
                          {professor.active ? "Bloquear acesso" : "Liberar acesso"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="m-0 mb-2 text-xs font-semibold text-white/50">Modalidades</p>
                      <div className="divide-y divide-white/10">
                        {activeModalities.map((modality) => {
                          const enabled = professor.modalityIds.includes(modality.id);
                          const slotCount =
                            (drafts[modality.id] ??
                              professor.schedules?.find((entry) => entry.modalityId === modality.id)
                                ?.slots ??
                              []).length;

                          return (
                            <div
                              key={modality.id}
                              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                            >
                              <button
                                type="button"
                                disabled={!enabled}
                                onClick={() =>
                                  setProfessorEditingModalityId((current) => ({
                                    ...current,
                                    [professor.id]:
                                      editingModalityId === modality.id ? null : modality.id,
                                  }))
                                }
                                className={`min-w-0 truncate text-left text-sm ${
                                  editingModalityId === modality.id
                                    ? "font-semibold text-[#f08a98]"
                                    : enabled
                                      ? "text-white"
                                      : "text-white/45"
                                } disabled:cursor-default`}
                              >
                                {modality.name}
                                {enabled && slotCount > 0 ? ` • ${slotCount} horário(s)` : ""}
                              </button>
                              <button
                                type="button"
                                disabled={updatingProfessorId === professor.id}
                                onClick={() => toggleProfessorModality(professor, modality.id)}
                                className={`shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-semibold ${
                                  enabled
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "border border-white/15 text-white/45"
                                }`}
                              >
                                {enabled ? "Ativa" : "Inativa"}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {editingModalityId &&
                      professor.modalityIds.includes(editingModalityId) &&
                      (() => {
                        const modality = activeModalities.find(
                          (item) => item.id === editingModalityId,
                        );
                        if (!modality) return null;
                        const draftSlots =
                          drafts[editingModalityId] ??
                          professor.schedules?.find((entry) => entry.modalityId === editingModalityId)
                            ?.slots ??
                          [];

                        return (
                          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                            <ModalitySchedulePicker
                              modality={modality}
                              selectedSlots={draftSlots}
                              professorLabel={professor.name ?? professor.email}
                              onChange={(slots) =>
                                setProfessorScheduleDrafts((current) => ({
                                  ...current,
                                  [professor.id]: {
                                    ...(current[professor.id] ?? {}),
                                    [editingModalityId]: slots,
                                  },
                                }))
                              }
                            />
                            <button
                              type="button"
                              disabled={updatingProfessorId === professor.id}
                              onClick={() => saveProfessorSchedule(professor)}
                              className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                            >
                              Salvar horários
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <WeeklyScheduleGrid
            title="Grade dos professores"
            entries={professorGridEntries}
            emptyMessage="Cadastre professores com horários por modalidade para montar a grade."
          />

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
                    const selected = form.modalityIds.includes(item.id);
                    const editing = formEditingModalityId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (!selected) {
                            toggleFormModality(item.id);
                          } else if (editing) {
                            toggleFormModality(item.id);
                          } else {
                            setFormEditingModalityId(item.id);
                          }
                        }}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          editing
                            ? "bg-[#e85d6f] text-white ring-2 ring-[#e85d6f]/40"
                            : selected
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "border border-white/15 text-white/60"
                        }`}
                      >
                        {item.name}
                        {selected ? ` • ${(formSchedules[item.id] ?? []).length} horário(s)` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
              {formEditingModalityId && form.modalityIds.includes(formEditingModalityId) ? (
                (() => {
                  const modality = activeModalities.find(
                    (item) => item.id === formEditingModalityId,
                  );
                  if (!modality) return null;
                  return (
                    <ModalitySchedulePicker
                      modality={modality}
                      selectedSlots={formSchedules[formEditingModalityId] ?? []}
                      onChange={(slots) =>
                        setFormSchedules((current) => ({
                          ...current,
                          [formEditingModalityId]: slots,
                        }))
                      }
                    />
                  );
                })()
              ) : form.modalityIds.length > 0 ? (
                <p className="m-0 text-xs text-white/45">
                  Clique em uma modalidade selecionada para escolher os horários.
                </p>
              ) : null}
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
        </div>
      )}
    </OwnerSectionPage>
  );
}
