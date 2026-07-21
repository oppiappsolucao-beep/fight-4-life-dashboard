import { WEEKDAY_LABELS, emptyScheduleSlot, type ScheduleSlot } from "../../lib/schedule";

interface ScheduleSlotEditorProps {
  title: string;
  slots: ScheduleSlot[];
  onChange: (slots: ScheduleSlot[]) => void;
}

export default function ScheduleSlotEditor({ title, slots, onChange }: ScheduleSlotEditorProps) {
  function updateSlot(index: number, patch: Partial<ScheduleSlot>) {
    onChange(slots.map((slot, currentIndex) => (currentIndex === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number) {
    onChange(slots.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm font-semibold text-white">{title}</p>
        <button
          type="button"
          onClick={() => onChange([...slots, emptyScheduleSlot()])}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75"
        >
          + Horário
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="m-0 mt-3 text-sm text-white/45">Nenhum horário cadastrado.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {slots.map((slot, index) => (
            <div
              key={`${slot.weekday}-${slot.startTime}-${slot.endTime}-${index}`}
              className="grid gap-2 rounded-xl border border-white/10 bg-black/25 p-3 sm:grid-cols-[1.1fr_0.9fr_0.9fr_auto]"
            >
              <label className="block text-xs text-white/50">
                Dia
                <select
                  value={slot.weekday}
                  onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {WEEKDAY_LABELS.map((label, weekday) => (
                    <option key={label} value={weekday} className="bg-zinc-900">
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-white/50">
                Início
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => updateSlot(index, { startTime: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/50">
                Fim
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(event) => updateSlot(index, { endTime: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <button
                type="button"
                onClick={() => removeSlot(index)}
                className="self-end rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-200"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
