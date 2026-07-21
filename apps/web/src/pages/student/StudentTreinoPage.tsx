import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import {
  WORKOUT_PHASES,
  formatWorkoutDateLabel,
  groupExercisesByPhase,
} from "../../lib/workout";
import type { StudentWorkout, WorkoutSummary } from "../../types/workout";
import StudentSectionPage from "./StudentSectionPage";

export default function StudentTreinoPage() {
  const session = getStudentSession();
  const [treinos, setTreinos] = useState<WorkoutSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [treino, setTreino] = useState<StudentWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTreino, setLoadingTreino] = useState(false);
  const [error, setError] = useState("");
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  const groupedExercises = useMemo(
    () => (treino ? groupExercisesByPhase(treino.exercises) : null),
    [treino],
  );

  const loadDates = useCallback(() => {
    if (!session?.id) {
      setLoading(false);
      setError("Faça login novamente para ver seu treino.");
      return;
    }

    setLoading(true);
    setError("");
    apiFetch<{ treinos: WorkoutSummary[] }>("/student/treinos", {}, session.id)
      .then((data) => {
        setTreinos(data.treinos);
        setSelectedDate((current) => {
          if (current && data.treinos.some((item) => item.workoutDate === current)) {
            return current;
          }
          return data.treinos[0]?.workoutDate ?? "";
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar treinos."),
      )
      .finally(() => setLoading(false));
  }, [session?.id]);

  const loadTreino = useCallback(
    (date: string) => {
      if (!session?.id || !date) {
        setTreino(null);
        return;
      }

      setLoadingTreino(true);
      setError("");
      apiFetch<{ treino: StudentWorkout | null }>(
        `/student/treino?date=${encodeURIComponent(date)}`,
        {},
        session.id,
      )
        .then((data) => {
          setTreino(data.treino);
          setDoneMap({});
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Erro ao carregar treino."),
        )
        .finally(() => setLoadingTreino(false));
    },
    [session?.id],
  );

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    if (selectedDate) {
      loadTreino(selectedDate);
    } else {
      setTreino(null);
    }
  }, [selectedDate, loadTreino]);

  function toggleDone(key: string) {
    setDoneMap((current) => ({ ...current, [key]: !current[key] }));
  }

  const completedCount = treino
    ? treino.exercises.filter((item) => doneMap[item.id ?? `${item.phase}-${item.order}`]).length
    : 0;

  return (
    <StudentSectionPage
      title="Treino"
      description="Escolha a data e execute sua ficha dividida em começo, meio e fim."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando datas...
        </div>
      ) : error && treinos.length === 0 ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : treinos.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-white/50">
            Nenhum treino publicado ainda. Fale com a recepção ou seu professor.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm sm:p-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
              Data do treino
            </label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60 sm:max-w-md"
            >
              {treinos.map((item) => (
                <option key={item.id} value={item.workoutDate} className="bg-zinc-900">
                  {formatWorkoutDateLabel(item.workoutDate)} — {item.title} ({item.exerciseCount}{" "}
                  exercícios)
                </option>
              ))}
            </select>
          </div>

          {loadingTreino ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-8 text-center text-sm text-white/50">
              Carregando treino...
            </div>
          ) : !treino ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-8 text-center text-sm text-white/50">
              Nenhum treino encontrado para esta data.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm">
                <p className="m-0 text-xs uppercase tracking-wide text-white/45">
                  {formatWorkoutDateLabel(treino.workoutDate)}
                </p>
                <h2 className="m-0 mt-1 text-lg font-semibold text-white">{treino.title}</h2>
                {treino.notes ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{treino.notes}</p>
                ) : null}
                <p className="mt-3 text-xs text-white/40">
                  {completedCount}/{treino.exercises.length} exercícios concluídos
                </p>
              </div>

              {WORKOUT_PHASES.map((phase) => {
                const items = groupedExercises?.[phase.id] ?? [];
                if (items.length === 0) return null;

                return (
                  <section key={phase.id} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="m-0 text-sm font-semibold uppercase tracking-wide text-[#e85d6f]">
                        {phase.label}
                      </h3>
                      <span className="text-xs text-white/40">{phase.description}</span>
                    </div>

                    {items.map((item) => {
                      const key = item.id ?? `${item.phase}-${item.order}`;
                      const mediaUrl = item.exercise.gifUrl ?? item.exercise.imageUrl;
                      const done = Boolean(doneMap[key]);

                      return (
                        <ExerciseCard
                          key={key}
                          item={item}
                          index={item.order}
                          mediaUrl={mediaUrl}
                          done={done}
                          onToggle={() => toggleDone(key)}
                        />
                      );
                    })}
                  </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </StudentSectionPage>
  );
}

function ExerciseCard({
  item,
  index,
  mediaUrl,
  done,
  onToggle,
}: {
  item: StudentWorkout["exercises"][number];
  index: number;
  mediaUrl: string | null;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-xl border backdrop-blur-sm transition ${
        done ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.05]"
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
              <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/45">
                Exercício {index}
              </p>
              <h4 className="m-0 mt-1 text-lg font-semibold text-white">{item.exercise.name}</h4>
              <p className="mt-1 text-sm text-white/45">
                {item.exercise.muscleGroup}
                {item.exercise.equipment ? ` • ${item.exercise.equipment}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
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
            <Metric label="Descanso" value={item.restSeconds ? `${item.restSeconds}s` : "—"} />
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
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[0.65rem] uppercase tracking-wide text-white/40">{label}</p>
      <p className="m-0 mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
