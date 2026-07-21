import { useCallback, useEffect, useMemo, useState } from "react";
import ModalityVideoPlayer from "../modality/ModalityVideoPlayer";
import { apiFetch } from "../../lib/api";
import { getStudentSession } from "../../lib/studentSession";
import { WEEKDAY_LABELS } from "../../lib/schedule";
import { formatWorkoutDateLabel, todayDateInputValue } from "../../lib/workout";
import {
  lessonToVideoCard,
  type ProfessorLessonItem,
  type StudentLessonSlotOption,
  type StudentTreinoAulasResponse,
} from "../../types/modality";

interface StudentLessonTreinoFlowProps {
  modalityId: string;
  modalityName: string;
  planoModalidade: string;
}

function lessonSlotKey(slot: Pick<StudentLessonSlotOption, "startTime" | "endTime">): string {
  return `${slot.startTime}-${slot.endTime}`;
}

export default function StudentLessonTreinoFlow({
  modalityId,
  modalityName,
  planoModalidade,
}: StudentLessonTreinoFlowProps) {
  const session = getStudentSession();
  const [classDate, setClassDate] = useState(todayDateInputValue());
  const [horarios, setHorarios] = useState<StudentLessonSlotOption[]>([]);
  const [weekday, setWeekday] = useState(0);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [activeLesson, setActiveLesson] = useState<ProfessorLessonItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedSlot = useMemo(
    () => horarios.find((item) => lessonSlotKey(item) === selectedSlotKey) ?? null,
    [horarios, selectedSlotKey],
  );

  const loadSchedule = useCallback(() => {
    if (!session?.id || !modalityId || !classDate) return;

    setLoading(true);
    setError("");
    apiFetch<StudentTreinoAulasResponse>(
      `/student/treino-aulas?modalityId=${encodeURIComponent(modalityId)}&classDate=${encodeURIComponent(classDate)}`,
      {},
      session.id,
    )
      .then((data) => {
        setHorarios(data.horarios);
        setWeekday(data.weekday);
        const firstWithLesson = data.horarios.find((item) => item.lesson);
        if (firstWithLesson) {
          setSelectedSlotKey(lessonSlotKey(firstWithLesson));
          setActiveLesson(firstWithLesson.lesson);
        } else {
          setSelectedSlotKey("");
          setActiveLesson(null);
        }
      })
      .catch((err) => {
        setHorarios([]);
        setActiveLesson(null);
        setSelectedSlotKey("");
        setError(err instanceof Error ? err.message : "Erro ao carregar aulas.");
      })
      .finally(() => setLoading(false));
  }, [session?.id, modalityId, classDate]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  function selectSlot(slot: StudentLessonSlotOption) {
    if (!slot.lesson) return;
    setSelectedSlotKey(lessonSlotKey(slot));
    setActiveLesson(slot.lesson);
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#e85d6f]/20 via-black/30 to-black/40 p-4">
        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
          Seu plano
        </p>
        <h2 className="m-0 mt-1 text-xl font-semibold text-white">{planoModalidade}</h2>
        <p className="m-0 mt-2 text-sm text-white/60">
          Modalidade: <strong>{modalityName}</strong>
        </p>
      </section>

      <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Data da aula
          </label>
          <input
            type="date"
            value={classDate}
            onChange={(event) => setClassDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[#e85d6f]/60"
          />
        </div>
        <div className="flex items-end">
          <p className="m-0 text-sm text-white/55">
            {WEEKDAY_LABELS[weekday]} • escolha o horário com aula publicada
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-10 text-center text-sm text-white/50">
          Carregando horários...
        </div>
      ) : horarios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/50">
          Nenhuma aula publicada para {formatWorkoutDateLabel(classDate)} em {modalityName}.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="m-0 text-sm font-semibold text-white">Horários do dia</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {horarios.map((slot) => {
                const key = lessonSlotKey(slot);
                const selected = selectedSlotKey === key;
                const disabled = !slot.lesson;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectSlot(slot)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? "bg-[#e85d6f] text-white"
                        : disabled
                          ? "cursor-not-allowed border border-white/10 text-white/30"
                          : "border border-white/15 text-white/70 hover:border-[#e85d6f]/40"
                    }`}
                  >
                    {slot.label}
                    {slot.professorName ? ` • ${slot.professorName}` : ""}
                    {disabled ? " (sem aula)" : ""}
                  </button>
                );
              })}
            </div>
          </section>

          {activeLesson ? (
            <ModalityVideoPlayer
              video={lessonToVideoCard(activeLesson)}
              professorName={
                activeLesson.professor?.name ?? activeLesson.professor?.email ?? selectedSlot?.professorName
              }
              classDate={formatWorkoutDateLabel(classDate)}
              timeLabel={selectedSlot?.label}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
              Selecione um horário com aula disponível para assistir.
            </div>
          )}
        </>
      )}
    </div>
  );
}
