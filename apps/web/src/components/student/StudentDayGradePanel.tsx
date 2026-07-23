import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import { formatWorkoutDateLabel } from "../../lib/workout";
import type { StudentDayGradeResponse } from "../../types/modality";

interface StudentDayGradePanelProps {
  classDate: string;
  selectedModalityId?: string;
  onSelectModality?: (modalityId: string) => void;
}

export default function StudentDayGradePanel({
  classDate,
  selectedModalityId,
  onSelectModality,
}: StudentDayGradePanelProps) {
  const session = getStudentSession();
  const [data, setData] = useState<StudentDayGradeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!session?.id || !classDate) return;
    setLoading(true);
    apiFetch<StudentDayGradeResponse>(
      `/student/grade-dia?classDate=${encodeURIComponent(classDate)}`,
      {},
      session.id,
    )
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [session?.id, classDate]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
        Carregando grade do dia...
      </section>
    );
  }

  if (!data || data.sequencia.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
        Nenhuma modalidade na grade para {formatWorkoutDateLabel(classDate)}.
      </section>
    );
  }

  const sequencia = selectedModalityId
    ? data.sequencia.filter((item) => item.modalityId === selectedModalityId)
    : data.sequencia;

  if (sequencia.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3">
        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Grade do dia
        </p>
        <p className="m-0 mt-1 text-sm text-white/70">
          {formatWorkoutDateLabel(classDate)} • {sequencia.length} horário(s)
        </p>
      </div>

      <div className="space-y-2">
        {sequencia.map((item, index) => {
          const selected = item.modalityId === selectedModalityId;
          return (
            <button
              key={`${item.modalityId}-${item.startTime}-${item.endTime}`}
              type="button"
              onClick={() => onSelectModality?.(item.modalityId)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-[#e85d6f] bg-[#e85d6f]/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {item.modalityName}
                </span>
                <span className="mt-0.5 block text-xs text-white/45">
                  {item.label}
                  {item.hasLesson ? " • Aula publicada" : " • Horário reservado"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
