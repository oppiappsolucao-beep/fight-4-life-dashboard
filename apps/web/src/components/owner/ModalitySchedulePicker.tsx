import {
  WEEKDAY_LABELS,
  formatTimeRange,
  scheduleSlotKey,
  scheduleSlotsEqual,
  type ScheduleSlot,
} from "../../lib/schedule";
import type { ModalityItem } from "../../types/modality";

interface ModalitySchedulePickerProps {
  modality: ModalityItem;
  selectedSlots: ScheduleSlot[];
  onChange: (slots: ScheduleSlot[]) => void;
}

export default function ModalitySchedulePicker({
  modality,
  selectedSlots,
  onChange,
}: ModalitySchedulePickerProps) {
  const available = modality.scheduleSlots ?? [];

  if (available.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
        <p className="m-0 text-sm font-semibold text-amber-100">
          Horários de {modality.name}
        </p>
        <p className="m-0 mt-2 text-xs text-amber-200/80">
          Nenhum horário cadastrado para esta modalidade. Configure os dias e horários em{" "}
          <strong>Modalidades</strong> antes de vincular o professor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="m-0 text-sm font-semibold text-white">
        Horários disponíveis — {modality.name}
      </p>
      <p className="m-0 mt-1 text-xs text-white/45">
        Selecione os horários em que o professor vai atuar nesta modalidade.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {available.map((slot) => {
          const selected = selectedSlots.some((item) => scheduleSlotsEqual(item, slot));
          return (
            <button
              key={scheduleSlotKey(slot)}
              type="button"
              onClick={() => {
                if (selected) {
                  onChange(selectedSlots.filter((item) => !scheduleSlotsEqual(item, slot)));
                  return;
                }
                onChange([...selectedSlots, slot]);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                  : "border border-white/15 text-white/65 hover:border-white/30"
              }`}
            >
              {WEEKDAY_LABELS[slot.weekday]} • {formatTimeRange(slot)}
            </button>
          );
        })}
      </div>
      {selectedSlots.length === 0 ? (
        <p className="m-0 mt-3 text-xs text-white/40">Nenhum horário selecionado.</p>
      ) : null}
    </div>
  );
}
