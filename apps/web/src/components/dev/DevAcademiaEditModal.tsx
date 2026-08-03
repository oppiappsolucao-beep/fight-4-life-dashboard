import { FormEvent, useEffect, useState } from "react";
import { formatCep, formatCnpj, formatCpf, formatPhone } from "../../lib/format";
import { apiFetch } from "../../lib/api";
import { notifyDevAcademiasChanged } from "../../lib/devAcademias";
import { academyPublicUrl, primaryAppBaseDomain } from "../../lib/tenantHost";

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const PLANOS = ["Bronze", "Prata", "Ouro"];
const PERIODOS = ["Mensal", "Anual"];
const FORMAS_PAGAMENTO = ["Cartão de Crédito", "Boleto", "Pix"];

const STEPS = [
  { id: 0, label: "Empresa", hint: "Dados e domínio" },
  { id: 1, label: "Acesso", hint: "Login do dono" },
  { id: 2, label: "Plano", hint: "SaaS e status" },
] as const;

interface AcademyFormData {
  razaoSocial: string;
  nomeFantasia: string;
  subdominio: string;
  cnpj: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefoneComercial: string;
  emailCorporativo: string;
  nomeResponsavel: string;
  cpfResponsavel: string;
  emailLogin: string;
  telefoneResponsavel: string;
  plano: string;
  periodo: string;
  formaPagamento: string;
  senha: string;
  confirmarSenha: string;
  active: boolean;
}

interface AcademyDetailResponse {
  id: string;
  slug: string;
  subdomain?: string;
  active: boolean;
  asaasAccountId?: string | null;
  asaasWalletId?: string | null;
  hasAsaasApiKey?: boolean;
  form: Omit<AcademyFormData, "senha" | "confirmarSenha" | "active"> & {
    subdominio?: string;
  };
  owner: { id: string; email: string; name: string | null; active: boolean } | null;
}

interface DevAcademiaEditModalProps {
  academiaId: string;
  academiaName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function DevAcademiaEditModal({
  academiaId,
  academiaName,
  onClose,
  onSaved,
}: DevAcademiaEditModalProps) {
  const [form, setForm] = useState<AcademyFormData | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [asaasAccountId, setAsaasAccountId] = useState<string | null>(null);
  const [asaasWalletId, setAsaasWalletId] = useState<string | null>(null);
  const [hasAsaasApiKey, setHasAsaasApiKey] = useState(false);
  const [asaasApiKeyInput, setAsaasApiKeyInput] = useState("");
  const [asaasLoading, setAsaasLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");

    apiFetch<AcademyDetailResponse>(`/dev/academias/${academiaId}`)
      .then((data) => {
        setForm({
          ...data.form,
          subdominio: data.form.subdominio ?? data.subdomain ?? data.slug ?? "",
          senha: "",
          confirmarSenha: "",
          active: data.active,
        });
        setAsaasAccountId(data.asaasAccountId ?? null);
        setAsaasWalletId(data.asaasWalletId ?? null);
        setHasAsaasApiKey(Boolean(data.hasAsaasApiKey));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar academia.");
      })
      .finally(() => setLoading(false));
  }, [academiaId]);

  async function vincularAsaas(force = false) {
    setAsaasLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{
        message: string;
        asaasAccountId: string;
        asaasWalletId: string;
        hasAsaasApiKey?: boolean;
      }>(`/dev/academias/${academiaId}/asaas-subaccount`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setAsaasAccountId(result.asaasAccountId);
      setAsaasWalletId(result.asaasWalletId);
      setHasAsaasApiKey(Boolean(result.hasAsaasApiKey));
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular Asaas.");
    } finally {
      setAsaasLoading(false);
    }
  }

  async function salvarChaveAsaas() {
    if (!asaasApiKeyInput.trim()) {
      setError("Cole a chave de API da subconta Asaas.");
      return;
    }
    setAsaasLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiFetch<{
        message: string;
        asaasAccountId: string;
        asaasWalletId: string;
        hasAsaasApiKey?: boolean;
      }>(`/dev/academias/${academiaId}/asaas-subaccount`, {
        method: "POST",
        body: JSON.stringify({ apiKey: asaasApiKeyInput.trim() }),
      });
      setAsaasAccountId(result.asaasAccountId);
      setAsaasWalletId(result.asaasWalletId);
      setHasAsaasApiKey(true);
      setAsaasApiKeyInput("");
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar chave Asaas.");
    } finally {
      setAsaasLoading(false);
    }
  }
  function updateField<K extends keyof AcademyFormData>(
    field: K,
    value: AcademyFormData[K],
  ) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    setSuccess("");
    setError("");
  }

  function handleMaskedChange(
    field: keyof AcademyFormData,
    value: string,
    formatter: (v: string) => string,
  ) {
    updateField(field, formatter(value));
  }

  function validateStep(current: number): string | null {
    if (!form) return "Formulário não carregado.";
    if (current === 0) {
      if (!form.razaoSocial.trim() || !form.nomeFantasia.trim()) {
        return "Informe a Razão Social e o Nome Fantasia.";
      }
      if (!form.cnpj.trim()) return "Informe o CNPJ da academia.";
      if (!form.subdominio.trim()) {
        return "Informe o subdomínio (ex.: fourarbjj).";
      }
      if (!form.emailCorporativo.trim()) return "Informe o e-mail corporativo.";
    }
    if (current === 1) {
      if (!form.nomeResponsavel.trim() || !form.cpfResponsavel.trim()) {
        return "Informe os dados do responsável.";
      }
      if (!form.emailLogin.trim()) return "Informe o e-mail de login.";
      if (form.senha && form.senha.length < 6) {
        return "A nova senha deve ter no mínimo 6 caracteres.";
      }
      if (form.senha && form.senha !== form.confirmarSenha) {
        return "As senhas não coincidem.";
      }
    }
    if (current === 2) {
      if (!form.plano || !form.periodo || !form.formaPagamento) {
        return "Selecione plano, período e forma de pagamento.";
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
    setSuccess("");

    try {
      const { senha, confirmarSenha, ...payload } = form;
      void confirmarSenha;

      const result = await apiFetch<{
        tenant: { url?: string; subdomain?: string };
        message: string;
      }>(`/dev/academias/${academiaId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          ...(senha ? { senha } : {}),
        }),
      });

      const url =
        result.tenant.url ||
        (form.subdominio.trim() ? academyPublicUrl(form.subdominio.trim()) : "");
      setSuccess(
        url
          ? `Salvo. Domínio: ${url.replace(/^https?:\/\//, "")} — lembre de cadastrar esse host no EasyPanel.`
          : "Alterações salvas com sucesso.",
      );
      notifyDevAcademiasChanged();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = form?.subdominio.trim()
    ? academyPublicUrl(form.subdominio.trim())
    : `https://[subdomínio].${primaryAppBaseDomain()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm md:p-8">
      <div className="relative my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#12161c] shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#12161c]/95 px-5 py-4 backdrop-blur md:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#4a9fd8]">
                Editar academia
              </p>
              <h2 className="m-0 mt-1 truncate text-lg font-semibold text-white">
                {academiaName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-[#4a9fd8]/40 hover:text-white"
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
                        "flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition sm:flex-row sm:justify-center sm:gap-2",
                        active
                          ? "bg-[#4a9fd8]/20 text-white ring-1 ring-[#4a9fd8]/45"
                          : done
                            ? "bg-white/[0.05] text-white/80"
                            : "bg-white/[0.03] text-white/45",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-bold",
                          active || done
                            ? "bg-gradient-to-br from-[#4a9fd8] to-[#d44d62] text-white"
                            : "bg-white/10 text-white/50",
                        ].join(" ")}
                      >
                        {done ? "✓" : item.id + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold sm:text-sm">{item.label}</span>
                        <span className="hidden text-[0.65rem] text-white/40 sm:block">
                          {item.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </div>

        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5 md:p-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-white/50">Carregando dados...</p>
          ) : null}

          {error && !form ? (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {form ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 0 ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Dados da empresa</h3>
                    <p className="mt-1 text-sm text-white/45">
                      Identificação fiscal, endereço e domínio público da academia.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#4a9fd8]/25 bg-[#4a9fd8]/10 p-4">
                    <Field label="Subdomínio" required>
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
                        <span className="text-sm text-white/50">
                          .{primaryAppBaseDomain()}
                        </span>
                      </div>
                    </Field>
                    <p className="mt-2 text-xs text-white/55">
                      URL:{" "}
                      <a
                        href={form.subdominio.trim() ? previewUrl : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-[#7ebef0] hover:underline"
                      >
                        {previewUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                    <p className="mt-2 text-[0.7rem] leading-relaxed text-amber-100/80">
                      Depois de salvar, cadastre este host em EasyPanel → Domains do serviço
                      (ou use o wildcard <code className="text-amber-50">*.oppifit.com.br</code>).
                      Sem isso o navegador mostra 404.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Razão Social" required>
                      <Input
                        value={form.razaoSocial}
                        onChange={(e) => updateField("razaoSocial", e.target.value)}
                      />
                    </Field>
                    <Field label="Nome Fantasia" required>
                      <Input
                        value={form.nomeFantasia}
                        onChange={(e) => updateField("nomeFantasia", e.target.value)}
                      />
                    </Field>
                    <Field label="CNPJ" required>
                      <Input
                        value={form.cnpj}
                        onChange={(e) => handleMaskedChange("cnpj", e.target.value, formatCnpj)}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Inscrição Municipal">
                        <Input
                          value={form.inscricaoMunicipal}
                          onChange={(e) => updateField("inscricaoMunicipal", e.target.value)}
                        />
                      </Field>
                      <Field label="Inscrição Estadual">
                        <Input
                          value={form.inscricaoEstadual}
                          onChange={(e) => updateField("inscricaoEstadual", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>

                  <p className="mb-0 text-[0.7rem] font-semibold uppercase tracking-[0.1rem] text-white/35">
                    Endereço e contato
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Rua" className="md:col-span-2">
                      <Input
                        value={form.rua}
                        onChange={(e) => updateField("rua", e.target.value)}
                      />
                    </Field>
                    <Field label="Número">
                      <Input
                        value={form.numero}
                        onChange={(e) => updateField("numero", e.target.value)}
                      />
                    </Field>
                    <Field label="Bairro">
                      <Input
                        value={form.bairro}
                        onChange={(e) => updateField("bairro", e.target.value)}
                      />
                    </Field>
                    <Field label="Cidade">
                      <Input
                        value={form.cidade}
                        onChange={(e) => updateField("cidade", e.target.value)}
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
                      />
                    </Field>
                    <Field label="Telefone comercial">
                      <Input
                        value={form.telefoneComercial}
                        onChange={(e) =>
                          handleMaskedChange("telefoneComercial", e.target.value, formatPhone)
                        }
                      />
                    </Field>
                    <Field label="E-mail corporativo" required className="md:col-span-2">
                      <Input
                        type="email"
                        value={form.emailCorporativo}
                        onChange={(e) => updateField("emailCorporativo", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Acesso do dono</h3>
                    <p className="mt-1 text-sm text-white/45">
                      Credenciais usadas em /dono/login nesta academia.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome do responsável" required className="md:col-span-2">
                      <Input
                        value={form.nomeResponsavel}
                        onChange={(e) => updateField("nomeResponsavel", e.target.value)}
                      />
                    </Field>
                    <Field label="CPF" required>
                      <Input
                        value={form.cpfResponsavel}
                        onChange={(e) =>
                          handleMaskedChange("cpfResponsavel", e.target.value, formatCpf)
                        }
                      />
                    </Field>
                    <Field label="Telefone celular">
                      <Input
                        value={form.telefoneResponsavel}
                        onChange={(e) =>
                          handleMaskedChange("telefoneResponsavel", e.target.value, formatPhone)
                        }
                      />
                    </Field>
                    <Field label="E-mail de login" required className="md:col-span-2">
                      <Input
                        type="email"
                        value={form.emailLogin}
                        onChange={(e) => updateField("emailLogin", e.target.value)}
                      />
                    </Field>
                    <Field label="Nova senha">
                      <Input
                        type="password"
                        value={form.senha}
                        onChange={(e) => updateField("senha", e.target.value)}
                        placeholder="Deixe em branco para manter"
                      />
                    </Field>
                    <Field label="Confirmar nova senha">
                      <Input
                        type="password"
                        value={form.confirmarSenha}
                        onChange={(e) => updateField("confirmarSenha", e.target.value)}
                        placeholder="Só se alterar a senha"
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="m-0 text-base font-semibold text-white">Plano e status</h3>
                    <p className="mt-1 text-sm text-white/45">
                      Configuração comercial e liberação de acesso.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => updateField("active", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/30 accent-[#4a9fd8]"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">
                        Academia e dono ativos
                      </span>
                      <span className="mt-0.5 block text-xs text-white/45">
                        Desmarque para bloquear o acesso em /dono/login.
                      </span>
                    </span>
                  </label>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="m-0 text-sm font-medium text-white">Asaas (subconta)</p>
                    <p className="m-0 mt-1 text-xs text-white/45">
                      {asaasWalletId
                        ? hasAsaasApiKey
                          ? `Pronta para cobrar no nome da academia · wallet ${asaasWalletId.slice(0, 8)}…`
                          : `Wallet ok, mas falta a chave da subconta (necessária para a fatura sair no nome da academia).`
                        : "Ainda sem subconta. Necessário para cobranças no nome da academia."}
                    </p>
                    {asaasAccountId ? (
                      <p className="m-0 mt-1 text-[0.65rem] text-white/35">
                        account {asaasAccountId}
                      </p>
                    ) : null}

                    {asaasWalletId && !hasAsaasApiKey ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="password"
                          value={asaasApiKeyInput}
                          onChange={(e) => setAsaasApiKeyInput(e.target.value)}
                          placeholder="Cole a API Key da subconta (aact_prod_... sem $)"
                          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={asaasLoading}
                          onClick={() => void salvarChaveAsaas()}
                          className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {asaasLoading ? "Validando..." : "Salvar chave da subconta"}
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={asaasLoading || (Boolean(asaasWalletId) && hasAsaasApiKey)}
                        onClick={() => void vincularAsaas(false)}
                        className="rounded-lg border border-[#4a9fd8]/40 px-3 py-1.5 text-xs font-semibold text-[#9fd0f0] hover:bg-[#4a9fd8]/10 disabled:opacity-50"
                      >
                        {asaasLoading
                          ? "Vinculando..."
                          : asaasWalletId && hasAsaasApiKey
                            ? "Já vinculada"
                            : "Criar / vincular subconta Asaas"}
                      </button>
                      {asaasWalletId && !hasAsaasApiKey ? (
                        <button
                          type="button"
                          disabled={asaasLoading}
                          onClick={() => void vincularAsaas(true)}
                          className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          Forçar nova subconta
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Plano" required>
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
                    <Field label="Forma de pagamento" required>
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
                </div>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {success}
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

const controlClass =
  "w-full rounded-xl border border-white/12 bg-[#0d1117] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#4a9fd8]/70 focus:ring-2 focus:ring-[#4a9fd8]/20 [color-scheme:dark]";

function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${className}`.trim()} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={controlClass} />;
}
