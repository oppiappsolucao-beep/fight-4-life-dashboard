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
  professorLabel?: string;
}

export default function ModalitySchedulePicker({
  modality,
  selectedSlots,
  onChange,
  professorLabel,
}: ModalitySchedulePickerProps) {
  const available = modality.scheduleSlots ?? [];
  const allSelected =
    available.length > 0 &&
    available.every((slot) => selectedSlots.some((item) => scheduleSlotsEqual(item, slot)));

  if (available.length === 0) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2.5">
        <p className="m-0 text-xs text-amber-200/90">
          Cadastre horários de <strong>{modality.name}</strong> em Modalidades antes de vincular o
          professor.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-sm font-semibold text-white">{modality.name}</p>
          <p className="m-0 mt-0.5 text-xs text-white/45">
            {professorLabel
              ? `Professor: ${professorLabel}`
              : "Escolha os horários em que o professor atua"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : [...available])}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-[0.65rem] font-semibold text-white/75"
        >
          {allSelected ? "Limpar horários" : "Selecionar todos"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold transition ${
                selected
                  ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40"
                  : "border border-white/15 text-white/65 hover:border-white/30"
              }`}
            >
              {WEEKDAY_LABELS[slot.weekday].slice(0, 3)} {formatTimeRange(slot)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
