import type { ReactNode } from "react";

export interface CatracaFormValue {
  usaCatraca: boolean;
  catracaIp: string;
  catracaPorta: string;
  catracaEquipamento: string;
  catracaSerie: string;
  catracaEdgeId: string;
  catracaTeclado: boolean;
  catracaFacial: boolean;
  catracaDigital: boolean;
}

export const CATRACA_FORM_DEFAULT: CatracaFormValue = {
  usaCatraca: false,
  catracaIp: "",
  catracaPorta: "7878",
  catracaEquipamento: "",
  catracaSerie: "",
  catracaEdgeId: "",
  catracaTeclado: false,
  catracaFacial: false,
  catracaDigital: false,
};

export function catracaFormError(value: CatracaFormValue): string | null {
  if (!value.usaCatraca) return null;
  if (!isIpv4(value.catracaIp.trim())) {
    return "Informe o IP da catraca. Ex.: 192.168.0.150.";
  }
  const porta = Number(value.catracaPorta);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    return "Informe a porta da catraca. Na Toletus, use 7878.";
  }
  if (!value.catracaTeclado && !value.catracaFacial && !value.catracaDigital) {
    return "Marque como o aluno se identifica: teclado, facial ou digital.";
  }
  return null;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#2E496C] outline-none transition placeholder:text-slate-400 focus:border-[#5B7595]/70 focus:ring-2 focus:ring-[#5B7595]/20";

export default function CatracaIntegracaoFields({
  value,
  onChange,
}: {
  value: CatracaFormValue;
  onChange: (next: CatracaFormValue) => void;
}) {
  function choose(usaCatraca: boolean) {
    onChange({
      ...value,
      usaCatraca,
      catracaPorta: usaCatraca && !value.catracaPorta.trim() ? "7878" : value.catracaPorta,
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Na venda, marque se esta academia vai liberar a entrada pela catraca.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={!value.usaCatraca}
          title="Não"
          description="A academia entra sem integração de catraca."
          onClick={() => choose(false)}
        />
        <ChoiceCard
          selected={value.usaCatraca}
          title="Sim"
          description="Pedir os dados para deixar a catraca integrada."
          onClick={() => choose(true)}
        />
      </div>

      {value.usaCatraca ? (
        <div className="space-y-4 rounded-xl border border-[#5B7595]/30 bg-[#5B7595]/10 p-4">
          <p className="text-xs leading-relaxed text-slate-600">
            No EdgeDesk do computador da recepção: o IP aparece no ícone da catraca. O Edge ID
            fica em Configurações, Pontos de acesso. A porta da placa Toletus é 7878.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="IP da catraca" required>
              <input
                value={value.catracaIp}
                onChange={(event) => onChange({ ...value, catracaIp: event.target.value.trim() })}
                placeholder="192.168.0.150"
                className={inputClass}
                inputMode="decimal"
              />
            </Field>
            <Field label="Porta" required>
              <input
                value={value.catracaPorta}
                onChange={(event) =>
                  onChange({ ...value, catracaPorta: event.target.value.replace(/\D/g, "") })
                }
                placeholder="7878"
                className={inputClass}
                inputMode="numeric"
              />
            </Field>
            <Field label="Equipamento">
              <input
                value={value.catracaEquipamento}
                onChange={(event) => onChange({ ...value, catracaEquipamento: event.target.value })}
                placeholder="Ex.: WZ3504"
                className={inputClass}
              />
            </Field>
            <Field label="Série">
              <input
                value={value.catracaSerie}
                onChange={(event) => onChange({ ...value, catracaSerie: event.target.value })}
                placeholder="Ex.: 9763"
                className={inputClass}
              />
            </Field>
            <Field label="Edge ID" className="md:col-span-2">
              <input
                value={value.catracaEdgeId}
                onChange={(event) => onChange({ ...value, catracaEdgeId: event.target.value.trim() })}
                placeholder="Ex.: vedLGuiVBlmNHQ"
                className={inputClass}
              />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-slate-600">
              Como o aluno se identifica <span className="text-[#5B7595]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                selected={value.catracaTeclado}
                label="Teclado"
                onClick={() => onChange({ ...value, catracaTeclado: !value.catracaTeclado })}
              />
              <ToggleChip
                selected={value.catracaFacial}
                label="Facial"
                onClick={() => onChange({ ...value, catracaFacial: !value.catracaFacial })}
              />
              <ToggleChip
                selected={value.catracaDigital}
                label="Digital"
                onClick={() => onChange({ ...value, catracaDigital: !value.catracaDigital })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-4 py-4 text-left transition",
        selected
          ? "border-[#5B7595] bg-white ring-2 ring-[#5B7595]/40"
          : "border-slate-200 bg-white hover:border-[#5B7595]/40",
      ].join(" ")}
    >
      <span className="block text-sm font-bold uppercase tracking-wide text-[#2E496C]">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-500">{description}</span>
    </button>
  );
}

function ToggleChip({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        selected
          ? "border-[#2E496C] bg-[#2E496C] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-[#5B7595]/50",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-slate-600">
        {label}
        {required ? <span className="text-[#5B7595]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
