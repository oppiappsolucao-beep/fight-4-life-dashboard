import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { formatCep, formatCnpj, formatCpf, formatPhone } from "../../lib/format";
import { apiFetch } from "../../lib/api";
import { notifyDevAcademiasChanged } from "../../lib/devAcademias";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const PLANOS = ["Bronze", "Prata", "Ouro"];
const PERIODOS = ["Mensal", "Anual"];
const FORMAS_PAGAMENTO = ["Cartão de Crédito", "Boleto", "Pix"];

const INITIAL_FORM = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoMunicipal: "",
  inscricaoEstadual: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  telefoneComercial: "",
  emailCorporativo: "",
  nomeResponsavel: "",
  cpfResponsavel: "",
  emailLogin: "",
  telefoneResponsavel: "",
  senha: "",
  confirmarSenha: "",
  plano: "",
  periodo: "",
  formaPagamento: "",
};

type FormData = typeof INITIAL_FORM;

interface RegisterResult {
  tenantName: string;
  emailLogin: string;
}

export default function DevAcademiaForm() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<RegisterResult | null>(null);
  const [error, setError] = useState("");

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSuccess(null);
    setError("");
  }

  function handleMaskedChange(
    field: keyof FormData,
    value: string,
    formatter: (v: string) => string,
  ) {
    updateField(field, formatter(value));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess(null);

    if (!form.razaoSocial.trim() || !form.nomeFantasia.trim()) {
      setError("Informe a Razão Social e o Nome Fantasia.");
      return;
    }
    if (!form.cnpj.trim()) {
      setError("Informe o CNPJ da academia.");
      return;
    }
    if (!form.emailCorporativo.trim() || !form.emailLogin.trim()) {
      setError("Informe os e-mails corporativo e de login.");
      return;
    }
    if (!form.nomeResponsavel.trim() || !form.cpfResponsavel.trim()) {
      setError("Informe os dados do responsável.");
      return;
    }
    if (!form.senha || form.senha.length < 6) {
      setError("Defina uma senha com no mínimo 6 caracteres para o dono.");
      return;
    }
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!form.plano || !form.periodo || !form.formaPagamento) {
      setError("Selecione plano, período e forma de pagamento.");
      return;
    }

    setLoading(true);

    try {
      const { senha, confirmarSenha, ...payload } = form;
      void confirmarSenha;

      const result = await apiFetch<{
        tenant: { name: string };
        owner: { email: string };
      }>("/dev/academias", {
        method: "POST",
        body: JSON.stringify({ ...payload, senha }),
      });

      setSuccess({
        tenantName: result.tenant.name,
        emailLogin: result.owner.email,
      });
      setForm(INITIAL_FORM);
      notifyDevAcademiasChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar academia.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Dados Cadastrais da Empresa">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Razão Social" required>
            <Input
              value={form.razaoSocial}
              onChange={(e) => updateField("razaoSocial", e.target.value)}
              placeholder="Ex: Academia Iron Pulse Ltda"
            />
          </Field>
          <Field label="Nome Fantasia" required>
            <Input
              value={form.nomeFantasia}
              onChange={(e) => updateField("nomeFantasia", e.target.value)}
              placeholder="Ex: Iron Pulse Fitness"
            />
          </Field>
          <Field label="CNPJ" required>
            <Input
              value={form.cnpj}
              onChange={(e) => handleMaskedChange("cnpj", e.target.value, formatCnpj)}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inscrição Municipal">
              <Input
                value={form.inscricaoMunicipal}
                onChange={(e) => updateField("inscricaoMunicipal", e.target.value)}
                placeholder="Se aplicável"
              />
            </Field>
            <Field label="Inscrição Estadual">
              <Input
                value={form.inscricaoEstadual}
                onChange={(e) => updateField("inscricaoEstadual", e.target.value)}
                placeholder="Se aplicável"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          <Field label="Bairro">
            <Input
              value={form.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
              placeholder="Bairro"
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={form.cidade}
              onChange={(e) => updateField("cidade", e.target.value)}
              placeholder="Cidade"
            />
          </Field>
          <Field label="Estado">
            <Select
              value={form.estado}
              onChange={(e) => updateField("estado", e.target.value)}
            >
              <option value="">UF</option>
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CEP">
            <Input
              value={form.cep}
              onChange={(e) => handleMaskedChange("cep", e.target.value, formatCep)}
              placeholder="00000-000"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Telefone / WhatsApp Comercial">
            <Input
              value={form.telefoneComercial}
              onChange={(e) =>
                handleMaskedChange("telefoneComercial", e.target.value, formatPhone)
              }
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail Corporativo" required>
            <Input
              type="email"
              value={form.emailCorporativo}
              onChange={(e) => updateField("emailCorporativo", e.target.value)}
              placeholder="contato@academia.com.br"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Dados do Responsável / Administrador">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome Completo do Proprietário/Gestor" required className="md:col-span-2">
            <Input
              value={form.nomeResponsavel}
              onChange={(e) => updateField("nomeResponsavel", e.target.value)}
              placeholder="Nome completo"
            />
          </Field>
          <Field label="CPF" required>
            <Input
              value={form.cpfResponsavel}
              onChange={(e) =>
                handleMaskedChange("cpfResponsavel", e.target.value, formatCpf)
              }
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Telefone Celular">
            <Input
              value={form.telefoneResponsavel}
              onChange={(e) =>
                handleMaskedChange("telefoneResponsavel", e.target.value, formatPhone)
              }
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail de Login (usuário master)" required className="md:col-span-2">
            <Input
              type="email"
              value={form.emailLogin}
              onChange={(e) => updateField("emailLogin", e.target.value)}
              placeholder="dono@academia.com.br"
            />
            <p className="mt-1 text-[0.65rem] text-white/40">
              Este e-mail será o usuário master do sistema para o dono da academia.
            </p>
          </Field>
          <Field label="Senha de Acesso" required>
            <Input
              type="password"
              value={form.senha}
              onChange={(e) => updateField("senha", e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </Field>
          <Field label="Confirmar Senha" required>
            <Input
              type="password"
              value={form.confirmarSenha}
              onChange={(e) => updateField("confirmarSenha", e.target.value)}
              placeholder="Repita a senha"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Configurações do Plano / SaaS">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Plano Escolhido" required>
            <Select
              value={form.plano}
              onChange={(e) => updateField("plano", e.target.value)}
            >
              <option value="">Selecione</option>
              {PLANOS.map((plano) => (
                <option key={plano} value={plano}>
                  {plano}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Período" required>
            <Select
              value={form.periodo}
              onChange={(e) => updateField("periodo", e.target.value)}
            >
              <option value="">Selecione</option>
              {PERIODOS.map((periodo) => (
                <option key={periodo} value={periodo}>
                  {periodo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Forma de Pagamento" required>
            <Select
              value={form.formaPagamento}
              onChange={(e) => updateField("formaPagamento", e.target.value)}
            >
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma} value={forma}>
                  {forma}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Academia <strong>{success.tenantName}</strong> cadastrada com sucesso!
          O dono pode entrar em <strong>/dono/login</strong> com o e-mail{" "}
          <strong>{success.emailLogin}</strong> e a senha definida acima.
          {" "}
          <Link to="/dev/donos-academias" className="font-semibold underline hover:text-emerald-200">
            Ver em Donos de Academias
          </Link>
          {" · "}
          <Link to="/dev/contas-a-receber" className="font-semibold underline hover:text-emerald-200">
            Ver em Contas a Receber
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Cadastrar Academia"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(INITIAL_FORM);
            setSuccess(null);
            setError("");
          }}
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
