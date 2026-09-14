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
    return occurrences.ocorrencias.filter((item) => item.classDate >= today).slice(0, 20);
  }, [occurrences]);

  const occurrencesByDate = useMemo(() => {
    const grouped = new Map<string, OwnerScheduleOccurrencesResponse["ocorrencias"]>();
    for (const item of upcomingOccurrences) {
      const current = grouped.get(item.classDate) ?? [];
      current.push(item);
      grouped.set(item.classDate, current);
    }
    return Array.from(grouped.entries()).slice(0, 8);
  }, [upcomingOccurrences]);

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
    <div className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-semibold text-[#2E496C]">Horários — {modality.name}</p>
          <p className="m-0 mt-1 text-xs text-slate-400">
            Configure a grade semanal e, se quiser, repita automaticamente no mês.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
        >
          Fechar
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={repeatsMonthly}
          onChange={(event) => onRepeatsMonthlyChange(event.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-slate-600">
          Repetir estes horários automaticamente durante o mês
          <span className="mt-1 block text-xs text-slate-400">
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
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-60"
      >
        {saving ? "Salvando horários..." : "Salvar horários da modalidade"}
      </button>

      {repeatsMonthly && slots.length > 0 ? (
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[#2E496C]">Aulas do mês</p>
              <p className="m-0 mt-1 text-xs text-slate-400">
                Cancele uma ocorrência para bloquear a aula e liberar a vaga naquele dia.
              </p>
            </div>
            <label className="text-xs text-slate-500">
              Mês
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-[#2E496C]"
              />
            </label>
          </div>

          {occurrenceError ? (
            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {occurrenceError}
            </div>
          ) : null}

          {loadingOccurrences ? (
            <p className="m-0 text-sm text-slate-400">Carregando ocorrências...</p>
          ) : occurrencesByDate.length === 0 ? (
            <p className="m-0 text-sm text-slate-400">
              Nenhuma aula prevista neste mês com os horários cadastrados.
            </p>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {occurrencesByDate.map(([classDate, items]) => (
                <div
                  key={classDate}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"
                >
                  <p className="m-0 text-xs font-semibold text-[#2E496C]">
                    {formatWorkoutDateLabel(classDate)} • {WEEKDAY_LABELS[items[0]?.weekday ?? 0]}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {items.map((item) => {
                      const key = `${item.classDate}-${item.startTime}-${item.endTime}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={cancellingKey === key}
                          onClick={() => toggleCancellation(item)}
                          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold disabled:opacity-60 ${
                            item.cancelled
                              ? "border border-red-400/30 bg-red-500/10 text-red-700 line-through"
                              : "border border-slate-200 text-slate-600 hover:border-red-400/30"
                          }`}
                          title={item.cancelled ? "Reativar aula" : "Cancelar aula"}
                        >
                          {formatTimeRange(item)}
                          {cancellingKey === key ? " ..." : item.cancelled ? " ✕" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
