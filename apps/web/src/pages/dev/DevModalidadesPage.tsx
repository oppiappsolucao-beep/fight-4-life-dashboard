import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { contentTypeLabel, type ModalityTemplate } from "../../types/modality";
import DevSectionPage from "./DevSectionPage";

export default function DevModalidadesPage() {
  const [templates, setTemplates] = useState<ModalityTemplate[]>([]);
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState<"VIDEO_GALLERY" | "EXERCISE_CATALOG">(
    "VIDEO_GALLERY",
  );
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ templates: ModalityTemplate[] }>("/dev/modality-templates")
      .then((data) => setTemplates(data.templates.filter((item) => item.active)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar modalidades."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiFetch<{ message: string }>("/dev/modality-templates", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contentType,
          description: description.trim() || undefined,
        }),
      });
      setSuccess(result.message);
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DevSectionPage
      title="Modalidades da Plataforma"
      description="Cadastre aqui as modalidades que as academias poderão ofertar aos alunos. O dono escolhe quais ativar; o professor publica as aulas em vídeo."
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="m-0 text-sm font-semibold text-white">Nova modalidade</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-white/50">
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Jiu-Jitsu"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
                required
              />
            </label>
            <label className="block text-xs text-white/50">
              Tipo
              <select
                value={contentType}
                onChange={(e) =>
                  setContentType(e.target.value as "VIDEO_GALLERY" | "EXERCISE_CATALOG")
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              >
                <option value="VIDEO_GALLERY">Galeria de vídeos (professor publica aulas)</option>
                <option value="EXERCISE_CATALOG">Catálogo de treinos (musculação)</option>
              </select>
            </label>
            <label className="block text-xs text-white/50">
              Descrição
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white"
              />
            </label>
          </div>
          {error ? (
            <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-[#e85d6f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Adicionar modalidade"}
          </button>
        </form>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="m-0 text-sm font-semibold text-white">Modalidades disponíveis</p>
          {loading ? (
            <p className="mt-4 text-sm text-white/45">Carregando...</p>
          ) : templates.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">Nenhuma modalidade cadastrada.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {templates.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="m-0 font-semibold text-white">{item.name}</p>
                  <p className="m-0 mt-1 text-xs text-white/50">{contentTypeLabel(item.contentType)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DevSectionPage>
  );
}
