import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import StudentSectionPage from "./StudentSectionPage";

type DietMeal = {
  id: string;
  dayOfWeek: number;
  dayLabel: string;
  mealType: string;
  mealTypeLabel: string;
  title: string;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  ingredients: string[];
  instructions: string | null;
  imageUrl: string | null;
  sortOrder: number;
};

type DietPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  goal: string;
  targetCalories: number;
  meals: DietMeal[];
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const GOAL_LABELS: Record<string, string> = {
  EMAGRECIMENTO: "Emagrecimento",
  MANUTENCAO: "Manutenção",
  HIPERTROFIA: "Ganho de massa",
};

function todayWeekday(): number {
  return new Date().getDay();
}

function formatMacro(value: number | null | undefined, suffix: string) {
  if (value == null) return "—";
  return `${Math.round(value)}${suffix}`;
}

export default function StudentDietasPage() {
  const [dieta, setDieta] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(todayWeekday);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ dieta: DietPlan | null }>("/student/dieta")
      .then((data) => {
        if (cancelled) return;
        setDieta(data.dieta);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar dieta.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dayMeals = useMemo(() => {
    if (!dieta) return [];
    return dieta.meals
      .filter((meal) => meal.dayOfWeek === selectedDay)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [dieta, selectedDay]);

  const dayTotals = useMemo(() => {
    return dayMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.calories ?? 0),
        proteinG: acc.proteinG + (meal.proteinG ?? 0),
        carbsG: acc.carbsG + (meal.carbsG ?? 0),
        fatG: acc.fatG + (meal.fatG ?? 0),
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  }, [dayMeals]);

  const selectedMeal = useMemo(
    () => dayMeals.find((meal) => meal.id === selectedMealId) ?? null,
    [dayMeals, selectedMealId],
  );

  useEffect(() => {
    setSelectedMealId(null);
  }, [selectedDay]);

  return (
    <StudentSectionPage
      title="Dietas"
      description="Plano alimentar liberado pela academia para acompanhar seu objetivo."
    >
      {loading ? (
        <p className="text-sm text-white/50">Carregando plano alimentar...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : !dieta ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-6 text-center sm:p-10">
          <p className="m-0 text-sm text-white/60">
            Nenhuma dieta liberada ainda. Peça ao responsável da academia para vincular um
            plano no seu cadastro.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0b1f3a]/80 to-[#122a4a]/50 p-5">
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.08rem] text-[#7ebef0]">
              {GOAL_LABELS[dieta.goal] ?? dieta.goal}
            </p>
            <h2 className="mt-1.5 mb-2 text-xl font-semibold text-white">{dieta.name}</h2>
            {dieta.description ? (
              <p className="m-0 max-w-2xl text-sm leading-relaxed text-white/60">
                {dieta.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-white/80">
                Meta diária: <strong className="text-white">{dieta.targetCalories} kcal</strong>
              </span>
              <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-white/80">
                Dia selecionado:{" "}
                <strong className="text-white">{Math.round(dayTotals.calories)} kcal</strong>
              </span>
            </div>
          </section>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {WEEKDAYS.map((label, day) => {
              const active = selectedDay === day;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`min-w-[3.1rem] rounded-lg px-3 py-2.5 text-center text-xs font-semibold transition ${
                    active
                      ? "bg-[#4a9fd8] text-white"
                      : "border border-white/10 bg-white/[0.04] text-white/65 hover:border-[#4a9fd8]/40 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Kcal", Math.round(dayTotals.calories)],
                ["Prot.", `${Math.round(dayTotals.proteinG)}g`],
                ["Carb.", `${Math.round(dayTotals.carbsG)}g`],
                ["Gord.", `${Math.round(dayTotals.fatG)}g`],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <p className="m-0 text-[0.65rem] uppercase tracking-wide text-white/45">{label}</p>
                <p className="mt-1 mb-0 text-lg font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {dayMeals.map((meal) => {
              const open = selectedMealId === meal.id;
              return (
                <article
                  key={meal.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedMealId(open ? null : meal.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-[#7ebef0]">
                        {meal.mealTypeLabel}
                      </p>
                      <h3 className="mt-1 mb-0 text-base font-semibold text-white">{meal.title}</h3>
                      <p className="mt-1.5 mb-0 text-xs text-white/50">
                        {formatMacro(meal.calories, " kcal")} · P{" "}
                        {formatMacro(meal.proteinG, "g")} · C {formatMacro(meal.carbsG, "g")} · G{" "}
                        {formatMacro(meal.fatG, "g")}
                      </p>
                    </div>
                    <span className="mt-1 text-white/40">{open ? "−" : "+"}</span>
                  </button>

                  {open && selectedMeal ? (
                    <div className="border-t border-white/10 px-4 py-4">
                      {selectedMeal.description ? (
                        <p className="mt-0 mb-3 text-sm text-white/60">{selectedMeal.description}</p>
                      ) : null}
                      <h4 className="mt-0 mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                        Ingredientes
                      </h4>
                      <ul className="mb-4 mt-0 list-disc space-y-1 pl-5 text-sm text-white/75">
                        {selectedMeal.ingredients.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {selectedMeal.instructions ? (
                        <>
                          <h4 className="mt-0 mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">
                            Preparo
                          </h4>
                          <p className="m-0 text-sm leading-relaxed text-white/70">
                            {selectedMeal.instructions}
                          </p>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <p className="m-0 text-xs leading-relaxed text-white/40">
            Orientação alimentar da academia — não substitui avaliação de nutricionista. Ajuste
            porções conforme orientação profissional e necessidades individuais.
          </p>
        </div>
      )}
    </StudentSectionPage>
  );
}
