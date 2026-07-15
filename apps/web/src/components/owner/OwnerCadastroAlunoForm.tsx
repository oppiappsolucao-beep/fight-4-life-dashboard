import { FormEvent, useState } from "react";
import { formatCep, formatCpf, formatPhone } from "../../lib/format";
import OwnerStudentPhotoField from "./OwnerStudentPhotoField";

const GENEROS = ["Masculino", "Feminino", "Outro", "Prefiro não informar"];
const MODALIDADES = [
  "Musculação Livre",
  "Plano Trimestral",
  "Plano Semestral",
  "Plano Anual",
  "Pilates",
  "Muay Thai",
  "Jiu-Jitsu",
  "MMA",
];
const FORMAS_PAGAMENTO = ["Dinheiro", "Cartão", "Pix", "Débito"];
const PARENTESCOS = ["Pai", "Mãe", "Cônjuge", "Irmão(ã)", "Amigo(a)", "Outro"];

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
  rua: "",
  numero: "",
  cep: "",
  cidade: "",
  planoModalidade: "",
  dataInicio: "",
  diaVencimento: "",
  formaPagamento: "",
};

type FormData = typeof INITIAL_FORM;

export default function OwnerCadastroAlunoForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [, setFotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(preview);
    setFotoFile(file ?? null);
    setSuccess(false);
    setError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (!form.nomeCompleto.trim()) {
      setError("Informe o nome completo.");
      return;
    }
    if (!form.cpf.trim() || !form.dataNascimento) {
      setError("Informe CPF e data de nascimento.");
      return;
    }
    if (!form.email.trim()) {
      setError("Informe o e-mail para acesso do aluno.");
      return;
    }
    if (!form.planoModalidade || !form.dataInicio || !form.diaVencimento) {
      setError("Preencha os dados da matrícula.");
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
    setSuccess(true);
  }

  function handleClear() {
    setForm(INITIAL_FORM);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    setFotoFile(null);
    setSuccess(false);
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Informações Pessoais">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo" required className="md:col-span-2">
            <Input
              value={form.nomeCompleto}
              onChange={(e) => updateField("nomeCompleto", e.target.value)}
              placeholder="Ex: Ana Carolina Silva"
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
          <Field label="Data de Nascimento" required>
            <Input
              type="date"
              value={form.dataNascimento}
              onChange={(e) => updateField("dataNascimento", e.target.value)}
            />
            <p className="mt-1 text-[0.65rem] text-white/40">
              Usado para controle de menores e cálculo automático de faixa etária.
            </p>
          </Field>
          <Field label="Gênero (opcional)">
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
      </FormSection>

      <FormSection title="Contato e Endereço">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="E-mail" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="aluno@email.com"
            />
            <p className="mt-1 text-[0.65rem] text-white/40">
              Para o aluno acessar o app, receber treinos e cobranças.
            </p>
          </Field>
          <Field label="Telefone / WhatsApp">
            <Input
              value={form.telefone}
              onChange={(e) => handleMaskedChange("telefone", e.target.value, formatPhone)}
              placeholder="(00) 00000-0000"
            />
          </Field>
        </div>

        <p className="mb-3 mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/50">
          Telefone de Emergência
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nome do Contato">
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

        <p className="mb-3 mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/50">
          Endereço Residencial
        </p>
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
      </FormSection>

      <FormSection title="Dados da Matrícula">
        <p className="mb-4 text-[0.65rem] text-white/40">Uso interno da academia.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Plano / Modalidade" required className="md:col-span-2">
            <Select
              value={form.planoModalidade}
              onChange={(e) => updateField("planoModalidade", e.target.value)}
            >
              <option value="">Selecione</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data de Início da Matrícula" required>
            <Input
              type="date"
              value={form.dataInicio}
              onChange={(e) => updateField("dataInicio", e.target.value)}
            />
          </Field>
          <Field label="Dia de Vencimento da Mensalidade" required>
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
          <Field label="Forma de Pagamento Recorrente" required className="md:col-span-2">
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
        </div>
      </FormSection>

      <FormSection title="Foto do Aluno">
        <OwnerStudentPhotoField preview={fotoPreview} onPreviewChange={handlePhotoChange} />
      </FormSection>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Aluno cadastrado com sucesso!
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Cadastrar Aluno"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg border border-white/15 px-6 py-2.5 text-[0.75rem] font-medium text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"
        >
          Limpar formulário
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm md:p-6">
      <h2 className="mb-5 border-b border-white/10 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-white">
        {title}
      </h2>
      {children}
    </section>
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
      <span className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-white/75">
        {label}
        {required && <span className="text-[#e85d6f]"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-[0.82rem] text-black outline-none transition focus:border-[#e85d6f]/60 focus:ring-2 focus:ring-[#e85d6f]/15";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}
