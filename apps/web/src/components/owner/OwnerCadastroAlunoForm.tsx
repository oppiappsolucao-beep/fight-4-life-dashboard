import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatCep, formatCpf, formatPhone } from "../../lib/format";
import { apiFetch } from "../../lib/api";
import {
  DEFAULT_OWNER_PLANS,
  formatPlanCurrency,
  type PlanItem,
} from "../../lib/plans";
import { isMinorStudent } from "../../lib/studentAge";
import OwnerStudentPhotoField from "./OwnerStudentPhotoField";

const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão", "Pix", "Débito"];
const PARENTESCOS = ["Pai", "Mãe", "Cônjuge", "Irmão(ã)", "Amigo(a)", "Outro"];
const RESPONSAVEL_PARENTESCOS = ["Pai", "Mãe", "Tutor(a)", "Avô(ó)", "Outro"];

const STEPS = [
  { id: 0, label: "Pessoal", hint: "Identificação" },
  { id: 1, label: "Contato", hint: "Endereço e emergência" },
  { id: 2, label: "Matrícula", hint: "Plano e pagamento" },
  { id: 3, label: "Foto", hint: "Opcional" },
] as const;

const INITIAL_FORM = {
  nomeCompleto: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  genero: "",
  email: "",
  telefone: "",
  emergenciaNome: "",
  emergenciaParentesco: "",
  emergenciaTelefone: "",
  responsavelNome: "",
  responsavelCpf: "",
  responsavelEmail: "",
  responsavelTelefone: "",
  responsavelParentesco: "",
  rua: "",
  numero: "",
  cep: "",
  cidade: "",
  planoModalidade: "",
  dataInicio: "",
  diaVencimento: "",
  formaPagamento: "",
  dietPlanId: "",
};

type FormData = typeof INITIAL_FORM;

type DietPlanOption = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  targetCalories: number;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

export default function OwnerCadastroAlunoForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [step, setStep] = useState(0);
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [dietas, setDietas] = useState<DietPlanOption[]>([]);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const isMinor = useMemo(
    () => Boolean(form.dataNascimento) && isMinorStudent(form.dataNascimento),
    [form.dataNascimento],
  );

  useEffect(() => {
    apiFetch<{ planos: PlanItem[] }>("/owner/planos")
      .then((data) => {
        if (data.planos.length) setPlanos(data.planos);
      })
      .catch(() => {
        // Mantém defaults se a API falhar
      });

    apiFetch<{ dietas: DietPlanOption[] }>("/owner/dietas")
      .then((data) => {
        setDietas(data.dietas ?? []);
      })
      .catch(() => {
        setDietas([]);
      });
  }, []);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError("");
  }

  function handleMaskedChange(
    field: keyof FormData,
    value: string,
    formatter: (v: string) => string,
  ) {
    updateField(field, formatter(value));
  }

  function handlePhotoChange(preview: string | null, file?: File) {
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(preview);
    setFotoFile(file ?? null);
    setSuccess(false);
    setError("");
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!form.nomeCompleto.trim()) return "Informe o nome completo.";
      if (!form.cpf.trim() || !form.dataNascimento) {
        return "Informe CPF e data de nascimento.";
      }
    }
    if (current === 1) {
      if (!form.email.trim()) return "Informe o e-mail para acesso do aluno.";
      if (isMinor) {
        if (
          !form.responsavelNome.trim() ||
          !form.responsavelCpf.trim() ||
          !form.responsavelEmail.trim()
        ) {
          return "Aluno menor de 18 anos: informe nome, CPF e e-mail do responsável.";
        }
      }
    }
    if (current === 2) {
      if (!form.planoModalidade || !form.dataInicio || !form.diaVencimento) {
        return "Preencha os dados da matrícula.";
      }
      if (!form.formaPagamento) return "Selecione a forma de pagamento.";
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((value) => Math.max(value - 1, 0));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }

    setLoading(true);
    try {
      let fotoUrl: string | undefined;
      if (fotoFile) {
        fotoUrl = await fileToDataUrl(fotoFile);
      } else if (fotoPreview?.startsWith("data:")) {
        fotoUrl = fotoPreview;
      }

      await apiFetch("/owner/alunos", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          fotoUrl,
          dietPlanId: form.dietPlanId || null,
        }),
      });

      setSuccess(true);
      setForm(INITIAL_FORM);
      if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setFotoFile(null);
      setStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar aluno.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setForm(INITIAL_FORM);
    if (fotoPreview?.startsWith("blob:")) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    setFotoFile(null);
    setSuccess(false);
    setError("");
    setStep(0);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Etapas do cadastro" className="overflow-x-auto">
        <ol className="flex min-w-max items-stretch gap-2 sm:min-w-0 sm:gap-0">
          {STEPS.map((item, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <li key={item.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index <= step) {
                      setError("");
                      setStep(index);
                    }
                  }}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                    active
                      ? "bg-[#4a9fd8]/15 ring-1 ring-[#4a9fd8]/40"
                      : done
                        ? "bg-white/[0.04] hover:bg-white/[0.07]"
                        : "bg-transparent opacity-55",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active || done
                        ? "bg-gradient-to-br from-[#4a9fd8] to-[#d44d62] text-white"
                        : "bg-white/10 text-white/50",
                    ].join(" ")}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{item.label}</span>
                    <span className="hidden text-[0.7rem] text-white/45 sm:block">
                      {item.hint}
                    </span>
                  </span>
                </button>
                {index < STEPS.length - 1 ? (
                  <span className="mx-1 hidden h-px w-4 shrink-0 bg-white/15 sm:block" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 md:p-7">
        {step === 0 ? (
          <StepBlock
            title="Informações pessoais"
            description="Dados básicos para identificar o aluno na academia."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo" required className="md:col-span-2">
                <Input
                  value={form.nomeCompleto}
                  onChange={(e) => updateField("nomeCompleto", e.target.value)}
                  placeholder="Ex: Ana Carolina Silva"
                  autoFocus
                />
              </Field>
              <Field label="CPF" required>
                <Input
                  value={form.cpf}
                  onChange={(e) => handleMaskedChange("cpf", e.target.value, formatCpf)}
                  placeholder="000.000.000-00"
                />
              </Field>
              <Field label="RG">
                <Input
                  value={form.rg}
                  onChange={(e) => updateField("rg", e.target.value)}
                  placeholder="00.000.000-0"
                />
              </Field>
              <Field label="Data de nascimento" required>
                <Input
                  type="date"
                  value={form.dataNascimento}
                  onChange={(e) => updateField("dataNascimento", e.target.value)}
                />
              </Field>
              <Field label="Gênero">
                <Select
                  value={form.genero}
                  onChange={(e) => updateField("genero", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {GENEROS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </StepBlock>
        ) : null}

        {step === 1 ? (
          <StepBlock
            title="Contato e endereço"
            description="Usados para login do aluno e comunicação da academia."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="E-mail" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="aluno@email.com"
                  autoFocus
                />
              </Field>
              <Field label="Telefone / WhatsApp">
                <Input
                  value={form.telefone}
                  onChange={(e) => handleMaskedChange("telefone", e.target.value, formatPhone)}
                  placeholder="(00) 00000-0000"
                />
              </Field>
            </div>

            <Divider label="Telefone de emergência" />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nome do contato">
                <Input
                  value={form.emergenciaNome}
                  onChange={(e) => updateField("emergenciaNome", e.target.value)}
                  placeholder="Nome completo"
                />
              </Field>
              <Field label="Parentesco">
                <Select
                  value={form.emergenciaParentesco}
                  onChange={(e) => updateField("emergenciaParentesco", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {PARENTESCOS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Telefone">
                <Input
                  value={form.emergenciaTelefone}
                  onChange={(e) =>
                    handleMaskedChange("emergenciaTelefone", e.target.value, formatPhone)
                  }
                  placeholder="(00) 00000-0000"
                />
              </Field>
            </div>

            {isMinor ? (
              <>
                <Divider label="Responsável financeiro (obrigatório — menor de 18)" />
                <p className="m-0 -mt-2 mb-3 text-xs text-amber-200/80">
                  Cobranças Asaas serão emitidas em nome do responsável, não do aluno.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome do responsável" required>
                    <Input
                      value={form.responsavelNome}
                      onChange={(e) => updateField("responsavelNome", e.target.value)}
                      placeholder="Nome completo"
                    />
                  </Field>
                  <Field label="CPF do responsável" required>
                    <Input
                      value={form.responsavelCpf}
                      onChange={(e) =>
                        handleMaskedChange("responsavelCpf", e.target.value, formatCpf)
                      }
                      placeholder="000.000.000-00"
                    />
                  </Field>
                  <Field label="E-mail do responsável" required>
                    <Input
                      type="email"
                      value={form.responsavelEmail}
                      onChange={(e) => updateField("responsavelEmail", e.target.value)}
                      placeholder="responsavel@email.com"
                    />
                  </Field>
                  <Field label="Telefone do responsável">
                    <Input
                      value={form.responsavelTelefone}
                      onChange={(e) =>
                        handleMaskedChange("responsavelTelefone", e.target.value, formatPhone)
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </Field>
                  <Field label="Parentesco">
                    <Select
                      value={form.responsavelParentesco}
                      onChange={(e) => updateField("responsavelParentesco", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {RESPONSAVEL_PARENTESCOS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            ) : null}

            <Divider label="Endereço residencial" />
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Rua" className="md:col-span-2">
                <Input
                  value={form.rua}
                  onChange={(e) => updateField("rua", e.target.value)}
                  placeholder="Nome da rua"
                />
              </Field>
              <Field label="Número">
                <Input
                  value={form.numero}
                  onChange={(e) => updateField("numero", e.target.value)}
                  placeholder="Nº"
                />
              </Field>
              <Field label="CEP">
                <Input
                  value={form.cep}
                  onChange={(e) => handleMaskedChange("cep", e.target.value, formatCep)}
                  placeholder="00000-000"
                />
              </Field>
              <Field label="Cidade" className="md:col-span-2">
                <Input
                  value={form.cidade}
                  onChange={(e) => updateField("cidade", e.target.value)}
                  placeholder="Cidade"
                />
              </Field>
            </div>
          </StepBlock>
        ) : null}

        {step === 2 ? (
          <StepBlock
            title="Dados da matrícula"
            description="Plano, vencimento e liberação de dieta no app do aluno."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Plano / modalidade" required className="md:col-span-2">
                <Select
                  value={form.planoModalidade}
                  onChange={(e) => updateField("planoModalidade", e.target.value)}
                  autoFocus
                >
                  <option value="">Selecione</option>
                  {planos.map((plan) => (
                    <option key={plan.nome} value={plan.nome}>
                      {plan.nome} — {formatPlanCurrency(plan.valor)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data de início" required>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) => updateField("dataInicio", e.target.value)}
                />
              </Field>
              <Field label="Dia de vencimento" required>
                <Select
                  value={form.diaVencimento}
                  onChange={(e) => updateField("diaVencimento", e.target.value)}
                >
                  <option value="">Selecione o dia</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                    <option key={dia} value={String(dia)}>
                      Dia {dia}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Forma de pagamento" required className="md:col-span-2">
                <Select
                  value={form.formaPagamento}
                  onChange={(e) => updateField("formaPagamento", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plano de dieta" className="md:col-span-2">
                <Select
                  value={form.dietPlanId}
                  onChange={(e) => updateField("dietPlanId", e.target.value)}
                >
                  <option value="">Sem dieta liberada</option>
                  {dietas.map((dieta) => (
                    <option key={dieta.id} value={dieta.id}>
                      {dieta.name} — ~{dieta.targetCalories} kcal/dia
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-white/40">
                  O aluno verá as refeições na aba Dicas do app.
                </p>
              </Field>
            </div>
          </StepBlock>
        ) : null}

        {step === 3 ? (
          <StepBlock
            title="Foto do aluno"
            description="Opcional. Ajuda a reconhecer o aluno na lista e no treino."
          >
            <OwnerStudentPhotoField preview={fotoPreview} onPreviewChange={handlePhotoChange} />
          </StepBlock>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Aluno cadastrado com sucesso!{" "}
            <Link to="/dono/alunos" className="font-semibold underline">
              Ver na lista de alunos
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-3 py-2 text-sm text-white/50 transition hover:text-white"
          >
            Limpar
          </button>
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Voltar
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-[#4a9fd8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f7fb8]"
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-[#4a9fd8] to-[#d44d62] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {loading ? "Salvando..." : "Cadastrar aluno"}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function StepBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="m-0 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-white/45">{description}</p>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <p className="mb-3 mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.1rem] text-white/35">
      {label}
    </p>
  );
}

function Field({
  label,
  children,
  required,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-white/55">
        {label}
        {required ? <span className="text-[#4a9fd8]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/12 bg-[#0d1117] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#4a9fd8]/70 focus:ring-2 focus:ring-[#4a9fd8]/20";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} [color-scheme:dark]`} />;
}
