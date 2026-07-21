import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import type { StudentWorkout } from "../../types/workout";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentTreinoPage() {
  const session = getStudentSession();
  const [treino, setTreino] = useState<StudentWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    if (!session?.id) {
      setLoading(false);
      setError("Faça login novamente para ver seu treino.");
      return;
    }

    setLoading(true);
    setError("");
    apiFetch<{ treino: StudentWorkout | null }>("/student/treino", {}, session.id)
      .then((data) => {
        setTreino(data.treino);
        setDoneMap({});
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar treino."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleDone(exerciseId: string) {
    setDoneMap((current) => ({
      ...current,
      [exerciseId]: !current[exerciseId],
    }));
  }

  const completedCount = treino
    ? treino.exercises.filter((item) => doneMap[item.id ?? item.exercise.id]).length
    : 0;

  return (
    <StudentSectionPage
      title="Treino"
      description="Sua ficha personalizada montada pelo professor ou dono da academia."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando seu treino...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : !treino ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Nenhum treino publicado ainda. Fale com a recepção ou seu professor.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
            <h2 className="m-0 text-lg font-semibold text-white">{treino.title}</h2>
            {treino.notes ? (
              <p className="mt-2 text-sm leading-relaxed text-white/60">{treino.notes}</p>
            ) : null}
            <p className="mt-3 text-xs text-white/40">
              {completedCount}/{treino.exercises.length} exercícios marcados como feitos
            </p>
          </div>

          {treino.exercises.map((item, index) => {
            const key = item.id ?? item.exercise.id;
            const mediaUrl = item.exercise.gifUrl ?? item.exercise.imageUrl;
            const done = Boolean(doneMap[key]);

            return (
              <article
                key={key}
                className={`overflow-hidden rounded-xl border backdrop-blur-sm transition ${
                  done
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : "border-white/10 bg-white/[0.05]"
                }`}
              >
                <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                  {mediaUrl ? (
                    <img
                      src={mediaUrl}
                      alt={item.exercise.name}
                      className="h-48 w-full object-cover md:h-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-black/20 text-sm text-white/35 md:h-full">
                      Sem imagem
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#e85d6f]">
                          Exercício {index + 1}
                        </p>
                        <h3 className="m-0 mt-1 text-lg font-semibold text-white">
                          {item.exercise.name}
                        </h3>
                        <p className="mt-1 text-sm text-white/45">
                          {item.exercise.muscleGroup}
                          {item.exercise.equipment ? ` • ${item.exercise.equipment}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleDone(key)}
                        className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          done
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-[#e85d6f]/20 text-[#f08a98] hover:bg-[#e85d6f]/30"
                        }`}
                      >
                        {done ? "Feito" : "Marcar feito"}
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric label="Séries" value={String(item.sets)} />
                      <Metric label="Repetições" value={item.reps} />
                      <Metric label="Carga" value={item.load || "—"} />
                      <Metric
                        label="Descanso"
                        value={item.restSeconds ? `${item.restSeconds}s` : "—"}
                      />
                    </div>

                    {item.notes ? (
                      <p className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                        {item.notes}
                      </p>
                    ) : null}

                    <div className="mt-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/45">
                        Como executar
                      </p>
                      <p className="m-0 text-sm leading-relaxed text-white/75">
                        {item.exercise.instructions}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </StudentSectionPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[0.65rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className="m-0 mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
