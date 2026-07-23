import { useCallback, useEffect, useMemo, useState } from "react";
import ScheduleSlotEditor from "./ScheduleSlotEditor";
import { apiFetch } from "../../lib/api";
import { currentMonthInput, WEEKDAY_LABELS, formatTimeRange } from "../../lib/schedule";
import { formatWorkoutDateLabel } from "../../lib/workout";
import type { ModalityItem, OwnerScheduleOccurrencesResponse, ScheduleSlot } from "../../types/modality";

interface OwnerModalitySchedulePanelProps {
  modality: ModalityItem;
  slots: ScheduleSlot[];
  repeatsMonthly: boolean;
  saving: boolean;
  onSlotsChange: (slots: ScheduleSlot[]) => void;
  onRepeatsMonthlyChange: (value: boolean) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function OwnerModalitySchedulePanel({
  modality,
  slots,
  repeatsMonthly,
  saving,
  onSlotsChange,
  onRepeatsMonthlyChange,
  onSave,
  onClose,
}: OwnerModalitySchedulePanelProps) {
  const [month, setMonth] = useState(currentMonthInput());
  const [occurrences, setOccurrences] = useState<OwnerScheduleOccurrencesResponse | null>(null);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [occurrenceError, setOccurrenceError] = useState("");

  const loadOccurrences = useCallback(() => {
    if (!repeatsMonthly || slots.length === 0) {
      setOccurrences(null);
      return;
    }

    setLoadingOccurrences(true);
    setOccurrenceError("");
    apiFetch<OwnerScheduleOccurrencesResponse>(
      `/owner/modalidades/${modality.id}/ocorrencias?month=${encodeURIComponent(month)}`,
    )
      .then(setOccurrences)
      .catch((err) => {
        setOccurrences(null);
        setOccurrenceError(
          err instanceof Error ? err.message : "Erro ao carregar ocorrências.",
        );
      })
      .finally(() => setLoadingOccurrences(false));
  }, [modality.id, month, repeatsMonthly, slots.length]);

  useEffect(() => {
    loadOccurrences();
  }, [loadOccurrences]);

  const upcomingOccurrences = useMemo(() => {
    if (!occurrences) return [];
    const today = new Date().toISOString().slice(0, 10);
    return occurrences.ocorrencias
      .filter((item) => item.classDate >= today)
      .slice(0, 12);
  }, [occurrences]);

  async function toggleCancellation(
    item: OwnerScheduleOccurrencesResponse["ocorrencias"][number],
  ) {
    const key = `${item.classDate}-${item.startTime}-${item.endTime}`;
    setCancellingKey(key);
    setOccurrenceError("");
    try {
      if (item.cancelled) {
        await apiFetch(`/owner/modalidades/${modality.id}/ocorrencias/cancelar`, {
          method: "DELETE",
          body: JSON.stringify({
            classDate: item.classDate,
            startTime: item.startTime,
            endTime: item.endTime,
          }),
        });
      } else {
        await apiFetch(`/owner/modalidades/${modality.id}/ocorrencias/cancelar`, {
          method: "POST",
          body: JSON.stringify({
            classDate: item.classDate,
            startTime: item.startTime,
            endTime: item.endTime,
          }),
        });
      }
      loadOccurrences();
    } catch (err) {
      setOccurrenceError(
        err instanceof Error ? err.message : "Erro ao atualizar cancelamento.",
      );
    } finally {
      setCancellingKey(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-semibold text-white">Horários — {modality.name}</p>
          <p className="m-0 mt-1 text-xs text-white/45">
            Configure a grade semanal e, se quiser, repita automaticamente no mês.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/75"
        >
          Fechar
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <input
          type="checkbox"
          checked={repeatsMonthly}
          onChange={(event) => onRepeatsMonthlyChange(event.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-white/75">
          Repetir estes horários automaticamente durante o mês
          <span className="mt-1 block text-xs text-white/45">
            O aluno verá as datas na grade sem precisar cadastrar tudo de novo toda semana.
          </span>
        </span>
      </label>

      <ScheduleSlotEditor
        title={`Dias e horários de ${modality.name}`}
        slots={slots}
        onChange={onSlotsChange}
        compact
      />

      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 disabled:opacity-60"
      >
        {saving ? "Salvando horários..." : "Salvar horários da modalidade"}
      </button>

      {repeatsMonthly && slots.length > 0 ? (
        <section className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-semibold text-white">Aulas do mês</p>
              <p className="m-0 mt-1 text-xs text-white/45">
                Cancele uma ocorrência para bloquear a aula e liberar a vaga naquele dia.
              </p>
            </div>
            <label className="text-xs text-white/50">
              Mês
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          {occurrenceError ? (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {occurrenceError}
            </div>
          ) : null}

          {loadingOccurrences ? (
            <p className="m-0 text-sm text-white/45">Carregando ocorrências...</p>
          ) : upcomingOccurrences.length === 0 ? (
            <p className="m-0 text-sm text-white/45">
              Nenhuma aula prevista neste mês com os horários cadastrados.
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {upcomingOccurrences.map((item) => {
                const key = `${item.classDate}-${item.startTime}-${item.endTime}`;
                return (
                  <div
                    key={key}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      item.cancelled
                        ? "border-red-400/20 bg-red-500/5"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-sm text-white">
                        {formatWorkoutDateLabel(item.classDate)} • {WEEKDAY_LABELS[item.weekday]}
                      </p>
                      <p className="m-0 text-xs text-white/45">
                        {formatTimeRange(item)}
                        {item.cancelled ? " • Cancelada" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={cancellingKey === key}
                      onClick={() => toggleCancellation(item)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                        item.cancelled
                          ? "border border-emerald-400/30 text-emerald-200"
                          : "border border-red-400/30 text-red-200"
                      }`}
                    >
                      {cancellingKey === key
                        ? "..."
                        : item.cancelled
                          ? "Reativar"
                          : "Cancelar aula"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
