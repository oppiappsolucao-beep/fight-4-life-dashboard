import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { formatCep, formatCnpj, formatCpf, formatPhone } from "../../lib/format";
import { apiFetch } from "../../lib/api";
import { notifyDevAcademiasChanged } from "../../lib/devAcademias";
import { academyPublicUrl, primaryAppBaseDomain } from "../../lib/tenantHost";
import AcademyPlanPicker from "./AcademyPlanPicker";
import type { PlatformPlan } from "../../types/platformPlan";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const INITIAL_FORM = {
  razaoSocial: "",
  nomeFantasia: "",
  subdominio: "",
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
  planId: "",
  faixa: 0,
  valor: 0,
};

type FormData = typeof INITIAL_FORM;

interface RegisterResult {
  tenantName: string;
  emailLogin: string;
  url: string;
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
    if (!form.planId || !form.plano || !form.periodo) {
      setError("Selecione o plano contratado pela academia.");
      return;
    }

    setLoading(true);

    try {
      const { senha, confirmarSenha, ...payload } = form;
      void confirmarSenha;

      const result = await apiFetch<{
        tenant: { name: string; url?: string; subdomain?: string; slug: string };
        owner: { email: string };
      }>("/dev/academias", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          senha,
          subdominio: form.subdominio.trim() || undefined,
        }),
      });

      setSuccess({
        tenantName: result.tenant.name,
        emailLogin: result.owner.email,
        url:
          result.tenant.url ||
          academyPublicUrl(result.tenant.subdomain || result.tenant.slug),
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
          <div className="md:col-span-2 rounded-xl border border-[#5B7595]/25 bg-[#5B7595]/10 p-4">
            <Field label="Subdomínio">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={form.subdominio}
                  onChange={(e) =>
                    updateField(
                      "subdominio",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  placeholder="Ex: fourarbjj"
                  className="sm:max-w-xs"
                />
                <span className="text-sm text-slate-500">identificador da academia</span>
              </div>
            </Field>
            <p className="mt-2 text-xs text-slate-500">
              URL de acesso (com SSL da plataforma):{" "}
              <span className="font-medium text-[#2E496C]">
                {form.subdominio.trim()
                  ? academyPublicUrl(form.subdominio.trim()).replace(/^https?:\/\//, "")
                  : `academia.${primaryAppBaseDomain()}/a/[gerado]`}
              </span>
              . Se o identificador ficar vazio, geramos a partir do nome fantasia.
            </p>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-600">
              A academia abre em{" "}
              <code className="rounded bg-white px-1 text-[#2E496C]">
                academia.{primaryAppBaseDomain()}/a/...
              </code>
              , no mesmo certificado do hub — sem o aviso de segurança do Chrome. Não use{" "}
              <code className="rounded bg-white px-1">usemint</code> nem{" "}
              <code className="rounded bg-white px-1">academia</code> como identificador.
            </p>
          </div>
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
            <p className="mt-1 text-[0.65rem] text-[#2E496C]/40">
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

      <FormSection title="Plano contratado">
        <Field label="Plano SaaS" required>
          <AcademyPlanPicker
            planId={form.planId}
            onSelect={(plan: PlatformPlan | null) => {
              if (!plan) {
                updateField("planId", "");
                updateField("plano", "");
                updateField("periodo", "");
                updateField("formaPagamento", "");
                updateField("faixa", 0);
                updateField("valor", 0);
                return;
              }
              setForm((prev) => ({
                ...prev,
                planId: plan.id,
                plano: plan.name,
                periodo: plan.billingType,
                formaPagamento: plan.formaPagamento,
                faixa: plan.studentLimit,
                valor: plan.price,
              }));
            }}
          />
        </Field>
        <p className="mt-2 text-xs text-slate-600">
          Cadastre novos planos em Desenvolvimento → Planos.
        </p>
      </FormSection>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          Academia <strong>{success.tenantName}</strong> cadastrada com sucesso!
          URL:{" "}
          <a
            href={success.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline hover:text-emerald-700"
          >
            {success.url}
          </a>
          . O dono entra em <strong>{success.url}/dono/login</strong> com{" "}
          <strong>{success.emailLogin}</strong>.
          {" "}
          <Link to="/dev/donos-academias" className="font-semibold underline hover:text-emerald-700">
            Ver em Donos de Academias
          </Link>
          {" · "}
          <Link to="/dev/contas-a-receber" className="font-semibold underline hover:text-emerald-700">
            Ver em Contas a Receber
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-[#2E496C] to-[#5B7595] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"
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
          className="rounded-lg border border-slate-200 px-6 py-2.5 text-[0.75rem] font-medium text-slate-600 transition hover:border-[#5B7595]/40 hover:text-[#2E496C]"
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 backdrop-blur-sm sm:p-5 md:p-6">
      <h2 className="mb-5 break-words border-b border-slate-200 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-[#2E496C]">
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
      <span className="mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.06rem] text-slate-600">
        {label}
        {required && <span className="text-[#5B7595]"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-[#2E496C] outline-none transition placeholder:text-slate-400 focus:border-[#5B7595]/70 focus:ring-2 focus:ring-[#5B7595]/20 [color-scheme:light]";

function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${className}`.trim()} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}
