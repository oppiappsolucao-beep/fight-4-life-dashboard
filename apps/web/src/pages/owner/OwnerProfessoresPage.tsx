import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { PlanItem } from "../../lib/plans";
import type { ModalityItem, ProfessorItem } from "../../types/modality";
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
  const [planos, setPlanos] = useState<PlanItem[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selfModalityIds, setSelfModalityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const galleryModalities = useMemo(
    () => modalidades.filter((item) => item.active && item.contentType === "VIDEO_GALLERY"),
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
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar professores."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFormModality(id: string) {
    setForm((current) => ({
      ...current,
      modalityIds: current.modalityIds.includes(id)
        ? current.modalityIds.filter((item) => item !== id)
        : [...current.modalityIds, id],
    }));
    setSuccess("");
  }

  function toggleSelfModality(id: string) {
    setSelfModalityIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setSuccess("");
  }

  async function handleCreateProfessor(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{ message: string }>("/owner/professores", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(result.message);
      setForm(EMPTY_FORM);
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
        body: JSON.stringify({ modalityIds: selfModalityIds }),
      });
      setSuccess(result.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao liberar seu acesso.");
    } finally {
      setSaving(false);
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
      description="Cadastre professores, libere modalidades e vincule planos. Cada professor publica suas aulas em vídeo no login de professor."
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
              Libere suas modalidades para montar aulas no painel do professor.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {galleryModalities.map((item) => (
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
                    <p className="m-0 font-semibold text-white">{professor.name ?? professor.email}</p>
                    <p className="m-0 mt-1 text-sm text-white/50">{professor.email}</p>
                    <p className="m-0 mt-2 text-xs text-white/45">
                      Modalidades:{" "}
                      {professor.modalityIds
                        .map((id) => galleryModalities.find((item) => item.id === id)?.name ?? id)
                        .join(", ") || "—"}
                    </p>
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
                <input
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Nome"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  placeholder="E-mail de acesso"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required
                />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                  placeholder="Senha inicial"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                  required
                />
                <div>
                  <p className="m-0 mb-2 text-xs text-white/50">Modalidades liberadas</p>
                  <div className="flex flex-wrap gap-2">
                    {galleryModalities.map((item) => (
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

          {galleryModalities.map((modality) => (
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
        </div>
      )}
    </OwnerSectionPage>
  );
}
