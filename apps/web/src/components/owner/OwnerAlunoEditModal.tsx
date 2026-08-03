import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatCep, formatCpf, formatPhone } from "../../lib/format";
import {
  DEFAULT_OWNER_PLANS,
  formatPlanCurrency,
  type PlanItem,
} from "../../lib/plans";
import { isMinorStudent } from "../../lib/studentAge";

const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão", "Pix", "Débito"];
const PARENTESCOS = ["Pai", "Mãe", "Cônjuge", "Irmão(ã)", "Amigo(a)", "Outro"];
const RESPONSAVEL_PARENTESCOS = ["Pai", "Mãe", "Tutor(a)", "Avô(ó)", "Outro"];

const STEPS = [
  { id: 0, label: "Pessoal" },
  { id: 1, label: "Contato" },
  { id: 2, label: "Matrícula" },
] as const;

interface StudentDetail {
  id: string;
  nomeCompleto: string;
  cpf: string;
  rg: string | null;
  dataNascimento: string;
  genero: string | null;
  email: string;
  telefone: string | null;
  emergenciaNome: string | null;
  emergenciaParentesco: string | null;
  emergenciaTelefone: string | null;
  responsavelNome: string | null;
  responsavelCpf: string | null;
  responsavelEmail: string | null;
  responsavelTelefone: string | null;
  responsavelParentesco: string | null;
  rua: string | null;
  numero: string | null;
  cep: string | null;
  cidade: string | null;
  planoModalidade: string;
  dataInicio: string;
  diaVencimento: string;
  formaPagamento: string | null;
  fotoUrl: string | null;
  dietPlanId: string | null;
  active: boolean;
}

type StudentForm = {
  [K in keyof Omit<StudentDetail, "id" | "active" | "fotoUrl" | "dietPlanId">]: string;
} & {
  fotoUrl: string | null;
  dietPlanId: string;
  active: boolean;
};

type DietPlanOption = {
  id: string;
  name: string;
  targetCalories: number;
};

interface OwnerAlunoEditModalProps {
  alunoId: string;
  onClose: () => void;
  onSaved: () => void;
}

function emptyToString(value: string | null): string {
  return value ?? "";
}

export default function OwnerAlunoEditModal({
  alunoId,
  onClose,
  onSaved,
}: OwnerAlunoEditModalProps) {
  const [form, setForm] = useState<StudentForm | null>(null);
  const [step, setStep] = useState(0);
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [dietas, setDietas] = useState<DietPlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isMinor = useMemo(
    () => Boolean(form?.dataNascimento) && isMinorStudent(form!.dataNascimento),
    [form?.dataNascimento],
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

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ aluno: StudentDetail }>(`/owner/alunos/${alunoId}`)
      .then(({ aluno }) => {
        if (cancelled) return;
        setForm({
          nomeCompleto: aluno.nomeCompleto,
          cpf: formatCpf(aluno.cpf),
          rg: emptyToString(aluno.rg),
          dataNascimento: aluno.dataNascimento,
          genero: emptyToString(aluno.genero),
          email: aluno.email,
          telefone: aluno.telefone ? formatPhone(aluno.telefone) : "",
          emergenciaNome: emptyToString(aluno.emergenciaNome),
          emergenciaParentesco: emptyToString(aluno.emergenciaParentesco),
          emergenciaTelefone: aluno.emergenciaTelefone
            ? formatPhone(aluno.emergenciaTelefone)
            : "",
          responsavelNome: emptyToString(aluno.responsavelNome),
          responsavelCpf: aluno.responsavelCpf ? formatCpf(aluno.responsavelCpf) : "",
          responsavelEmail: emptyToString(aluno.responsavelEmail),
          responsavelTelefone: aluno.responsavelTelefone
            ? formatPhone(aluno.responsavelTelefone)
            : "",
          responsavelParentesco: emptyToString(aluno.responsavelParentesco),
          rua: emptyToString(aluno.rua),
          numero: emptyToString(aluno.numero),
          cep: aluno.cep ? formatCep(aluno.cep) : "",
          cidade: emptyToString(aluno.cidade),
          planoModalidade: aluno.planoModalidade,
          dataInicio: aluno.dataInicio,
          diaVencimento: aluno.diaVencimento,
          formaPagamento: emptyToString(aluno.formaPagamento),
          fotoUrl: aluno.fotoUrl,
          dietPlanId: aluno.dietPlanId ?? "",
          active: aluno.active,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar aluno.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [alunoId]);

  function update<K extends keyof StudentForm>(field: K, value: StudentForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setError("");
  }

  function validateStep(current: number): string | null {
    if (!form) return "Formulário não carregado.";
    if (current === 0) {
      if (!form.nomeCompleto.trim() || !form.cpf.trim() || !form.dataNascimento) {
        return "Preencha nome, CPF e data de nascimento.";
      }
    }
    if (current === 1) {
      if (!form.email.trim()) return "Informe o e-mail do aluno.";
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    for (let index = 0; index < STEPS.length; index += 1) {
      const message = validateStep(index);
      if (message) {
        setStep(index);
        setError(message);
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      await apiFetch(`/owner/alunos/${alunoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          dietPlanId: form.dietPlanId || null,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar aluno.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#12161c] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#12161c]/95 px-5 py-4 backdrop-blur md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#4a9fd8]">
                Editar aluno
              </p>
              <h2 className="m-0 mt-1 truncate text-lg font-semibold text-white">
                {form?.nomeCompleto ?? "Carregando..."}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:text-white"
            >
              Fechar
            </button>
          </div>

          {!loading && form ? (
            <ol className="mt-4 flex gap-2">
              {STEPS.map((item) => {
                const active = item.id === step;
                const done = item.id < step;
                return (
                  <li key={item.id} className="flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setStep(item.id);
                      }}
                      className={[
                        "flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm",
                        active
                          ? "bg-[#4a9fd8]/20 text-white ring-1 ring-[#4a9fd8]/45"
                          : done
                            ? "bg-white/[0.05] text-white/80"
                            : "bg-white/[0.03] text-white/45",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem]",
                          active || done
                            ? "bg-[#4a9fd8] text-white"
                            : "bg-white/10 text-white/50",
                        ].join(" ")}
                      >
                        {done ? "✓" : item.id + 1}
                      </span>
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5 md:p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-white/50">Carregando...</p>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {form ? (
            <form
              onSubmit={handleSubmit}
              onKeyDown={(event) => {
                if (event.key === "Enter" && step < STEPS.length - 1) {
                  const target = event.target as HTMLElement;
                  if (target.tagName === "TEXTAREA") return;
                  event.preventDefault();
                  goNext();
                }
              }}
              className="space-y-5"
            >
              {form.fotoUrl && step === 0 ? (
                <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <img
                    src={form.fotoUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                  />
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-white/45">
                      Foto do cadastro
                    </p>
                    <p className="m-0 mt-1 text-sm text-white/70">
                      Imagem registrada no momento da matrícula.
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome completo" span>
                    <Input
                      required
                      value={form.nomeCompleto}
                      onChange={(e) => update("nomeCompleto", e.target.value)}
                    />
                  </Field>
                  <Field label="CPF">
                    <Input
                      required
                      value={form.cpf}
                      onChange={(e) => update("cpf", formatCpf(e.target.value))}
                    />
                  </Field>
                  <Field label="RG">
                    <Input value={form.rg} onChange={(e) => update("rg", e.target.value)} />
                  </Field>
                  <Field label="Data de nascimento">
                    <Input
                      required
                      type="date"
                      value={form.dataNascimento}
                      onChange={(e) => update("dataNascimento", e.target.value)}
                    />
                  </Field>
                  <Field label="Gênero">
                    <Select
                      value={form.genero}
                      onChange={(e) => update("genero", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {GENEROS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="E-mail">
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={form.telefone}
                      onChange={(e) => update("telefone", formatPhone(e.target.value))}
                    />
                  </Field>
                  <Field label="Contato de emergência">
                    <Input
                      value={form.emergenciaNome}
                      onChange={(e) => update("emergenciaNome", e.target.value)}
                    />
                  </Field>
                  <Field label="Parentesco">
                    <Select
                      value={form.emergenciaParentesco}
                      onChange={(e) => update("emergenciaParentesco", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {PARENTESCOS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Telefone de emergência">
                    <Input
                      value={form.emergenciaTelefone}
                      onChange={(e) =>
                        update("emergenciaTelefone", formatPhone(e.target.value))
                      }
                    />
                  </Field>
                  {isMinor ? (
                    <>
                      <div className="md:col-span-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
                        Menor de 18 anos: cobranças Asaas usam os dados do responsável.
                      </div>
                      <Field label="Nome do responsável">
                        <Input
                          required
                          value={form.responsavelNome}
                          onChange={(e) => update("responsavelNome", e.target.value)}
                        />
                      </Field>
                      <Field label="CPF do responsável">
                        <Input
                          required
                          value={form.responsavelCpf}
                          onChange={(e) =>
                            update("responsavelCpf", formatCpf(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="E-mail do responsável">
                        <Input
                          required
                          type="email"
                          value={form.responsavelEmail}
                          onChange={(e) => update("responsavelEmail", e.target.value)}
                        />
                      </Field>
                      <Field label="Telefone do responsável">
                        <Input
                          value={form.responsavelTelefone}
                          onChange={(e) =>
                            update("responsavelTelefone", formatPhone(e.target.value))
                          }
                        />
                      </Field>
                      <Field label="Parentesco do responsável">
                        <Select
                          value={form.responsavelParentesco}
                          onChange={(e) => update("responsavelParentesco", e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {RESPONSAVEL_PARENTESCOS.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </Select>
                      </Field>
                    </>
                  ) : null}
                  <Field label="Rua" span>
                    <Input value={form.rua} onChange={(e) => update("rua", e.target.value)} />
                  </Field>
                  <Field label="Número">
                    <Input
                      value={form.numero}
                      onChange={(e) => update("numero", e.target.value)}
                    />
                  </Field>
                  <Field label="CEP">
                    <Input
                      value={form.cep}
                      onChange={(e) => update("cep", formatCep(e.target.value))}
                    />
                  </Field>
                  <Field label="Cidade">
                    <Input
                      value={form.cidade}
                      onChange={(e) => update("cidade", e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Plano / modalidade">
                    <Select
                      required
                      value={form.planoModalidade}
                      onChange={(e) => update("planoModalidade", e.target.value)}
                    >
                      {(planos.some((plan) => plan.nome === form.planoModalidade)
                        ? planos
                        : [{ nome: form.planoModalidade, valor: 0 }, ...planos]
                      ).map((plan) => (
                        <option key={plan.nome} value={plan.nome}>
                          {plan.nome}
                          {plan.valor > 0 ? ` — ${formatPlanCurrency(plan.valor)}` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Data de início">
                    <Input
                      required
                      type="date"
                      value={form.dataInicio}
                      onChange={(e) => update("dataInicio", e.target.value)}
                    />
                  </Field>
                  <Field label="Dia do vencimento">
                    <Select
                      required
                      value={form.diaVencimento}
                      onChange={(e) => update("diaVencimento", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                        <option key={dia} value={String(dia)}>
                          Dia {dia}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Forma de pagamento">
                    <Select
                      value={form.formaPagamento}
                      onChange={(e) => update("formaPagamento", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {FORMAS_PAGAMENTO.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Plano de dieta" span>
                    <Select
                      value={form.dietPlanId}
                      onChange={(e) => update("dietPlanId", e.target.value)}
                    >
                      <option value="">Sem dieta liberada</option>
                      {dietas.map((dieta) => (
                        <option key={dieta.id} value={dieta.id}>
                          {dieta.name} — ~{dieta.targetCalories} kcal/dia
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/70"
                >
                  Cancelar
                </button>
                <div className="flex gap-2">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setStep((value) => value - 1);
                      }}
                      className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/75"
                    >
                      Voltar
                    </button>
                  ) : null}
                  {step < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-lg bg-[#4a9fd8] px-5 py-2.5 text-sm font-semibold text-white"
                    >
                      Continuar
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-gradient-to-r from-[#4a9fd8] to-[#d44d62] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "Salvando..." : "Salvar alterações"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  span = false,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={span ? "md:col-span-2" : ""}>
      <span className="mb-1.5 block text-xs font-medium text-white/55">{label}</span>
      {children}
    </label>
  );
}

const controlClass =
  "w-full rounded-xl border border-white/12 bg-[#0d1117] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[#4a9fd8]/70 focus:ring-2 focus:ring-[#4a9fd8]/20 [color-scheme:dark]";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={controlClass} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass} />;
}
