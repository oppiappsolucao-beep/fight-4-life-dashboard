import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ModalitySchedulePicker from "../../components/owner/ModalitySchedulePicker";
import WeeklyScheduleGrid from "../../components/owner/WeeklyScheduleGrid";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import type { PlanItem } from "../../lib/plans";
import { formatTimeRange, type ScheduleGridEntry } from "../../lib/schedule";
import type {
  ModalityItem,
  ProfessorItem,
  ProfessorLessonItem,
  ScheduleSlot,
} from "../../types/modality";
import OwnerSectionPage from "./OwnerSectionPage";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  modalityIds: [] as string[],
};

export default function OwnerProfessoresPage() {
  const { user } = useAuth();
  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [modalidades, setModalidades] = useState<ModalityItem[]>([]);
  const [planos, setPlanos] = useState<PlanItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSchedules, setFormSchedules] = useState<Record<string, ScheduleSlot[]>>({});
  const [selfModalityIds, setSelfModalityIds] = useState<string[]>([]);
  const [selfSchedules, setSelfSchedules] = useState<Record<string, ScheduleSlot[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingProfessorId, setUpdatingProfessorId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      apiFetch<{ planos: PlanItem[] }>("/owner/planos"),
    ])
      .then(([profData, modData, planData]) => {
        setProfessores(profData.professores);
        setModalidades(modData.modalidades);
        setPlanos(planData.planos);

        if (user?.id) {
          const selfProfessor = profData.professores.find((item) => item.id === user.id);
          if (selfProfessor) {
            setSelfModalityIds(selfProfessor.modalityIds);
            setSelfSchedules(
              Object.fromEntries(
                (selfProfessor.schedules ?? []).map((entry) => [entry.modalityId, entry.slots]),
              ),
            );
          }
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar professores."),
      )
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const professorGridEntries = useMemo<ScheduleGridEntry[]>(
    () =>
      professores.flatMap((professor) =>
        (professor.schedules ?? []).flatMap((entry) => {
          const modalityName =
            activeModalities.find((item) => item.id === entry.modalityId)?.name ?? "Modalidade";
          return entry.slots.map((slot) => ({
            ...slot,
            label: modalityName,
            sublabel: `${professor.name ?? professor.email} • ${formatTimeRange(slot)}`,
            tone: "professor" as const,
          }));
        }),
      ),
    [professores, activeModalities],
  );

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
      }

      return { ...current, modalityIds };
    });
    setSuccess("");
  }

  function toggleSelfModality(id: string) {
    setSelfModalityIds((current) => {
      const selected = current.includes(id);
      if (selected) {
        setSelfSchedules((schedules) => {
          const next = { ...schedules };
          delete next[id];
          return next;
        });
      }
      return selected ? current.filter((item) => item !== id) : [...current, id];
    });
    setSuccess("");
  }

  function buildSchedulesPayload(source: Record<string, ScheduleSlot[]>, modalityIds: string[]) {
    return modalityIds
      .filter((modalityId) => (source[modalityId] ?? []).length > 0)
      .map((modalityId) => ({
        modalityId,
        slots: source[modalityId] ?? [],
      }));
  }

  async function handleCreateProfessor(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/professores", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          schedules: buildSchedulesPayload(formSchedules, form.modalityIds),
        }),
      });
      setSuccess(result.message);
      setForm(EMPTY_FORM);
      setFormSchedules({});
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar professor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterSelf() {
    if (selfModalityIds.length === 0) {
      setError("Selecione ao menos uma modalidade para você.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/professores/eu", {
        method: "POST",
        body: JSON.stringify({
          modalityIds: selfModalityIds,
          schedules: buildSchedulesPayload(selfSchedules, selfModalityIds),
        }),
      });
      setSuccess(result.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao liberar seu acesso.");
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

  async function toggleModalityAccess(professor: ProfessorItem, modalityId: string, active: boolean) {
    await updateProfessor(
      professor.id,
      { modalityUpdates: [{ modalityId, active }] },
      active ? "Modalidade liberada para o professor." : "Modalidade bloqueada para o professor.",
    );
  }

  async function toggleLesson(professorId: string, lesson: ProfessorLessonItem) {
    setUpdatingProfessorId(professorId);
    setError("");
    try {
      await apiFetch(`/owner/professores/${professorId}/aulas/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !lesson.active }),
      });
      setSuccess(lesson.active ? "Aula bloqueada." : "Aula liberada para os alunos.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar aula.");
    } finally {
      setUpdatingProfessorId(null);
    }
  }

  async function saveLinkedPlans(modalityId: string, linkedPlans: string[]) {
    try {
      await apiFetch(`/owner/modalidades/${modalityId}`, {
        method: "PATCH",
        body: JSON.stringify({ linkedPlans }),
      });
      setSuccess("Planos vinculados atualizados.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar planos.");
    }
  }

  return (
    <OwnerSectionPage
      title="Professores"
      description="Cadastre professores, escolha horários da grade de cada modalidade e gerencie acessos, aulas e alunos."
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

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="m-0 text-sm font-semibold text-white">Eu também sou professor</p>
            <p className="m-0 mt-1 text-sm text-white/50">
              Selecione suas modalidades e os horários da grade em que você atua.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeModalities.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelfModality(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    selfModalityIds.includes(item.id)
                      ? "bg-[#e85d6f] text-white"
                      : "border border-white/15 text-white/70"
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {selfModalityIds.map((modalityId) => {
              const modality = activeModalities.find((item) => item.id === modalityId);
              if (!modality) return null;
              return (
                <div key={modalityId} className="mt-3">
                  <ModalitySchedulePicker
                    modality={modality}
                    selectedSlots={selfSchedules[modalityId] ?? []}
                    onChange={(slots) =>
                      setSelfSchedules((current) => ({ ...current, [modalityId]: slots }))
                    }
                  />
                </div>
              );
            })}
            <button
              type="button"
              onClick={handleRegisterSelf}
              disabled={saving}
              className="mt-4 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
            >
              Liberar meu acesso de professor
            </button>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <section className="space-y-3">
              <p className="m-0 text-sm font-semibold text-white">
                Professores cadastrados ({professores.length})
              </p>
              {professores.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                  Nenhum professor cadastrado.
                </div>
              ) : (
                professores.map((professor) => (
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

                    {(professor.modalityStats ?? []).map((stat) => {
                      const scheduleEntry = professor.schedules?.find(
                        (entry) => entry.modalityId === stat.modalityId,
                      );
                      return (
                        <div
                          key={stat.modalityId}
                          className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="m-0 text-sm font-semibold text-white">
                              {stat.modalityName}
                            </p>
                            <button
                              type="button"
                              disabled={updatingProfessorId === professor.id}
                              onClick={() =>
                                toggleModalityAccess(
                                  professor,
                                  stat.modalityId,
                                  !stat.assignmentActive,
                                )
                              }
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                stat.assignmentActive
                                  ? "border border-amber-400/30 text-amber-200"
                                  : "border border-emerald-400/30 text-emerald-200"
                              }`}
                            >
                              {stat.assignmentActive ? "Bloquear modalidade" : "Liberar modalidade"}
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-white/55 sm:grid-cols-2 lg:grid-cols-4">
                            <span>{stat.studentCount} aluno(s) no plano</span>
                            <span>
                              {stat.activeLessonCount}/{stat.lessonCount} aula(s) ativa(s)
                            </span>
                            <span>{stat.attendanceCount} presença(s)</span>
                            <span>
                              Horários:{" "}
                              {scheduleEntry?.slots.length
                                ? scheduleEntry.slots.map((slot) => formatTimeRange(slot)).join(" • ")
                                : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {(professor.recentLessons ?? []).length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/45">
                          Aulas recentes
                        </p>
                        {professor.recentLessons!.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/15 px-3 py-2"
                          >
                            <div>
                              <p className="m-0 text-sm text-white">{lesson.title}</p>
                              <p className="m-0 text-xs text-white/45">
                                {lesson.modality?.name ?? "Modalidade"} • {lesson.classDate} •{" "}
                                {lesson.attendanceCount} presença(s)
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={updatingProfessorId === professor.id}
                              onClick={() => toggleLesson(professor.id, lesson)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                lesson.active
                                  ? "border border-red-400/30 text-red-200"
                                  : "border border-emerald-400/30 text-emerald-200"
                              }`}
                            >
                              {lesson.active ? "Bloquear aula" : "Liberar aula"}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </section>

            <form
              onSubmit={handleCreateProfessor}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <p className="m-0 text-sm font-semibold text-white">Cadastrar professor</p>
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
                  />
                </label>
                <label className="block text-xs text-white/50">
                  Senha de acesso
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                    required
                  />
                </label>
                <div>
                  <p className="m-0 mb-2 text-xs text-white/50">Modalidades que leciona</p>
                  <div className="flex flex-wrap gap-2">
                    {activeModalities.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleFormModality(item.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          form.modalityIds.includes(item.id)
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "border border-white/15 text-white/60"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
                {form.modalityIds.map((modalityId) => {
                  const modality = activeModalities.find((item) => item.id === modalityId);
                  if (!modality) return null;
                  return (
                    <ModalitySchedulePicker
                      key={modalityId}
                      modality={modality}
                      selectedSlots={formSchedules[modalityId] ?? []}
                      onChange={(slots) =>
                        setFormSchedules((current) => ({ ...current, [modalityId]: slots }))
                      }
                    />
                  );
                })}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 w-full rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Cadastrar professor"}
              </button>
            </form>
          </div>

          {activeModalities.map((modality) => (
            <section key={modality.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="m-0 text-sm font-semibold text-white">
                Planos vinculados — {modality.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {planos.map((plan) => {
                  const selected = modality.linkedPlans.includes(plan.nome);
                  return (
                    <button
                      key={plan.nome}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? modality.linkedPlans.filter((item) => item !== plan.nome)
                          : [...modality.linkedPlans, plan.nome];
                        saveLinkedPlans(modality.id, next);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        selected
                          ? "bg-[#e85d6f]/20 text-[#f08a98]"
                          : "border border-white/15 text-white/60"
                      }`}
                    >
                      {plan.nome}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <WeeklyScheduleGrid
            title="Grade dos professores"
            entries={professorGridEntries}
            emptyMessage="Cadastre professores com horários por modalidade para montar a grade."
          />
        </div>
      )}
    </OwnerSectionPage>
  );
}
