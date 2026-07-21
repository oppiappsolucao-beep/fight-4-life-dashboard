import { useCallback, useEffect, useMemo, useState } from "react";
import ModalityVideoPlayer, {
  ModalityVideoCard,
} from "../../components/modality/ModalityVideoPlayer";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  lessonToVideoCard,
  type ProfessorLessonItem,
  type StudentGalleryResponse,
} from "../../types/modality";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentGaleriaPage() {
  const session = getStudentSession();
  const [gallery, setGallery] = useState<StudentGalleryResponse | null>(null);
  const [selectedModalityId, setSelectedModalityId] = useState("");
  const [activeLesson, setActiveLesson] = useState<ProfessorLessonItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    (modalityId?: string) => {
      if (!session?.id) {
        setLoading(false);
        setError("Faça login novamente.");
        return;
      }

      setLoading(true);
      setError("");
      const query = modalityId ? `?modalityId=${encodeURIComponent(modalityId)}` : "";
      apiFetch<StudentGalleryResponse>(`/student/galeria${query}`, {}, session.id)
        .then((data) => {
          setGallery(data);
          setSelectedModalityId(data.modalidadeSelecionada?.id ?? "");
          setActiveLesson((current) => {
            if (current && data.aulas.some((item) => item.id === current.id)) return current;
            return data.aulas[0] ?? null;
          });
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar galeria."),
        )
        .finally(() => setLoading(false));
    },
    [session?.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const selectedModalityName = useMemo(() => {
    if (!gallery) return "";
    return (
      gallery.modalidadeSelecionada?.name ??
      gallery.modalidadeAtual?.name ??
      gallery.planoModalidade
    );
  }, [gallery]);

  return (
    <StudentSectionPage
      title="Galeria de Aulas"
      description="Assista às aulas publicadas pelo professor da sua modalidade."
    >
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : gallery ? (
        <div className="space-y-4 pb-8">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-4">
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              Seu plano
            </p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-white">{gallery.planoModalidade}</h2>
            <p className="m-0 mt-2 text-sm text-white/60">
              Modalidade: <strong>{selectedModalityName}</strong>
            </p>
          </section>

          {gallery.modalidades.length > 1 ? (
            <section className="flex flex-wrap gap-2">
              {gallery.modalidades.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedModalityId(item.id);
                    setActiveLesson(null);
                    load(item.id);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    selectedModalityId === item.id
                      ? "bg-[#e85d6f] text-white"
                      : "border border-white/15 text-white/70"
                  }`}
                >
                  {item.name} ({item.lessonCount})
                </button>
              ))}
            </section>
          ) : null}

          {gallery.aulas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/50">
              Nenhuma aula publicada para {selectedModalityName} ainda.
            </div>
          ) : (
            <>
              {activeLesson ? (
                <ModalityVideoPlayer video={lessonToVideoCard(activeLesson)} />
              ) : null}
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {gallery.aulas.map((aula) => (
                  <ModalityVideoCard
                    key={aula.id}
                    video={lessonToVideoCard(aula)}
                    selected={activeLesson?.id === aula.id}
                    onSelect={() => setActiveLesson(aula)}
                  />
                ))}
              </section>
            </>
          )}
        </div>
      ) : null}
    </StudentSectionPage>
  );
}
