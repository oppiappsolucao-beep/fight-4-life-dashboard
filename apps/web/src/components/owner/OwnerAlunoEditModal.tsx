import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatCep, formatCpf, formatPhone } from "../../lib/format";
import {
  DEFAULT_OWNER_PLANS,
  formatPlanCurrency,
  type PlanItem,
} from "../../lib/plans";

const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão", "Pix", "Débito"];
const PARENTESCOS = ["Pai", "Mãe", "Cônjuge", "Irmão(ã)", "Amigo(a)", "Outro"];

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
  rua: string | null;
  numero: string | null;
  cep: string | null;
  cidade: string | null;
  planoModalidade: string;
  dataInicio: string;
  diaVencimento: string;
  formaPagamento: string | null;
  fotoUrl: string | null;
  active: boolean;
}

type StudentForm = {
  [K in keyof Omit<StudentDetail, "id" | "active" | "fotoUrl">]: string;
} & {
  fotoUrl: string | null;
  active: boolean;
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
  const [planos, setPlanos] = useState<PlanItem[]>(DEFAULT_OWNER_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ planos: PlanItem[] }>("/owner/planos")
      .then((data) => {
        if (data.planos.length) setPlanos(data.planos);
      })
      .catch(() => {
        // Mantém defaults se a API falhar
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
          rua: emptyToString(aluno.rua),
          numero: emptyToString(aluno.numero),
          cep: aluno.cep ? formatCep(aluno.cep) : "",
          cidade: emptyToString(aluno.cidade),
          planoModalidade: aluno.planoModalidade,
          dataInicio: aluno.dataInicio,
          diaVencimento: aluno.diaVencimento,
          formaPagamento: emptyToString(aluno.formaPagamento),
          fotoUrl: aluno.fotoUrl,
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError("");
    try {
      await apiFetch(`/owner/alunos/${alunoId}`, {
        method: "PATCH",
        body: JSON.stringify(form),
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
      <div className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#171717] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#171717]/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">
              Editar aluno
            </p>
            <h2 className="m-0 mt-1 text-lg font-semibold text-white">
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

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-white/50">Carregando...</p>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {form ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Section title="Dados pessoais">
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
                    {GENEROS.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
              </Section>

              <Section title="Contato">
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
                    {PARENTESCOS.map((item) => <option key={item}>{item}</option>)}
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
              </Section>

              <Section title="Endereço">
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
              </Section>

              <Section title="Matrícula">
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
                  <Input
                    required
                    value={form.diaVencimento}
                    onChange={(e) => update("diaVencimento", e.target.value)}
                  />
                </Field>
                <Field label="Forma de pagamento">
                  <Select
                    value={form.formaPagamento}
                    onChange={(e) => update("formaPagamento", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {FORMAS_PAGAMENTO.map((item) => <option key={item}>{item}</option>)}
                  </Select>
                </Field>
              </Section>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/70"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#e85d6f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-4 mt-0 text-sm font-semibold text-white/85">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
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
  "w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#e85d6f]/60";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={controlClass} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass} />;
}
