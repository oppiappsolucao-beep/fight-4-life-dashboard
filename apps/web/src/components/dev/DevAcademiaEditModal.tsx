import { FormEvent, useEffect, useState } from "react";

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



interface AcademyFormData {

  razaoSocial: string;

  nomeFantasia: string;

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

  active: boolean;

  form: Omit<AcademyFormData, "senha" | "confirmarSenha" | "active">;

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

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");



  useEffect(() => {

    setLoading(true);

    setError("");



    apiFetch<AcademyDetailResponse>(`/dev/academias/${academiaId}`)

      .then((data) => {

        setForm({

          ...data.form,

          senha: "",

          confirmarSenha: "",

          active: data.active,

        });

      })

      .catch((err) => {

        setError(err instanceof Error ? err.message : "Erro ao carregar academia.");

      })

      .finally(() => setLoading(false));

  }, [academiaId]);



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



  async function handleSubmit(event: FormEvent) {

    event.preventDefault();

    if (!form) return;



    setError("");

    setSuccess("");



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

    if (form.senha && form.senha.length < 6) {

      setError("A nova senha deve ter no mínimo 6 caracteres.");

      return;

    }

    if (form.senha && form.senha !== form.confirmarSenha) {

      setError("As senhas não coincidem.");

      return;

    }

    if (!form.plano || !form.periodo || !form.formaPagamento) {

      setError("Selecione plano, período e forma de pagamento.");

      return;

    }



    setSaving(true);



    try {

      const { senha, confirmarSenha, ...payload } = form;

      void confirmarSenha;



      await apiFetch(`/dev/academias/${academiaId}`, {

        method: "PATCH",

        body: JSON.stringify({

          ...payload,

          ...(senha ? { senha } : {}),

        }),

      });



      setSuccess("Alterações salvas com sucesso.");

      notifyDevAcademiasChanged();
      onSaved();

    } catch (err) {

      setError(err instanceof Error ? err.message : "Erro ao salvar alterações.");

    } finally {

      setSaving(false);

    }

  }



  return (

    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm md:p-8">

      <div className="relative my-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1a1a1a]/95 px-6 py-4 backdrop-blur-md">

          <div>

            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12rem] text-[#e85d6f]">

              Editar academia

            </p>

            <h2 className="m-0 text-lg font-semibold text-white">{academiaName}</h2>

          </div>

          <button

            type="button"

            onClick={onClose}

            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"

          >

            Fechar

          </button>

        </div>



        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">

          {loading && (

            <p className="py-10 text-center text-sm text-white/50">Carregando dados...</p>

          )}



          {error && !form && (

            <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">

              {error}

            </div>

          )}



          {form && (

            <form onSubmit={handleSubmit} className="space-y-6">

              <FormSection title="Status do Acesso">

                <label className="flex cursor-pointer items-center gap-3">

                  <input

                    type="checkbox"

                    checked={form.active}

                    onChange={(e) => updateField("active", e.target.checked)}

                    className="h-4 w-4 rounded border-white/30 accent-[#e85d6f]"

                  />

                  <span className="text-sm text-white/80">

                    Academia e dono <strong>ativos</strong> (desmarque para bloquear o acesso em /dono/login)

                  </span>

                </label>

              </FormSection>



              <FormSection title="Dados Cadastrais da Empresa">

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



                <div className="mt-4 grid gap-4 md:grid-cols-3">

                  <Field label="Rua" className="md:col-span-2">

                    <Input value={form.rua} onChange={(e) => updateField("rua", e.target.value)} />

                  </Field>

                  <Field label="Número">

                    <Input value={form.numero} onChange={(e) => updateField("numero", e.target.value)} />

                  </Field>

                  <Field label="Bairro">

                    <Input value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} />

                  </Field>

                  <Field label="Cidade">

                    <Input value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} />

                  </Field>

                  <Field label="Estado">

                    <Select value={form.estado} onChange={(e) => updateField("estado", e.target.value)}>

                      <option value="">UF</option>

                      {UF_LIST.map((uf) => (

                        <option key={uf} value={uf}>{uf}</option>

                      ))}

                    </Select>

                  </Field>

                  <Field label="CEP">

                    <Input

                      value={form.cep}

                      onChange={(e) => handleMaskedChange("cep", e.target.value, formatCep)}

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

                    />

                  </Field>

                  <Field label="E-mail Corporativo" required>

                    <Input

                      type="email"

                      value={form.emailCorporativo}

                      onChange={(e) => updateField("emailCorporativo", e.target.value)}

                    />

                  </Field>

                </div>

              </FormSection>



              <FormSection title="Acesso do Dono (/dono/login)">

                <div className="grid gap-4 md:grid-cols-2">

                  <Field label="Nome Completo do Proprietário/Gestor" required className="md:col-span-2">

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

                  <Field label="Telefone Celular">

                    <Input

                      value={form.telefoneResponsavel}

                      onChange={(e) =>

                        handleMaskedChange("telefoneResponsavel", e.target.value, formatPhone)

                      }

                    />

                  </Field>

                  <Field label="E-mail de Login" required className="md:col-span-2">

                    <Input

                      type="email"

                      value={form.emailLogin}

                      onChange={(e) => updateField("emailLogin", e.target.value)}

                    />

                    <p className="mt-1 text-[0.65rem] text-white/40">

                      E-mail usado pelo dono para entrar em /dono/login

                    </p>

                  </Field>

                  <Field label="Nova Senha">

                    <Input

                      type="password"

                      value={form.senha}

                      onChange={(e) => updateField("senha", e.target.value)}

                      placeholder="Deixe em branco para manter a atual"

                    />

                  </Field>

                  <Field label="Confirmar Nova Senha">

                    <Input

                      type="password"

                      value={form.confirmarSenha}

                      onChange={(e) => updateField("confirmarSenha", e.target.value)}

                      placeholder="Repita apenas se alterar a senha"

                    />

                  </Field>

                </div>

              </FormSection>



              <FormSection title="Configurações do Plano / SaaS">

                <div className="grid gap-4 md:grid-cols-3">

                  <Field label="Plano Escolhido" required>

                    <Select value={form.plano} onChange={(e) => updateField("plano", e.target.value)}>

                      <option value="">Selecione</option>

                      {PLANOS.map((plano) => (

                        <option key={plano} value={plano}>{plano}</option>

                      ))}

                    </Select>

                  </Field>

                  <Field label="Período" required>

                    <Select value={form.periodo} onChange={(e) => updateField("periodo", e.target.value)}>

                      <option value="">Selecione</option>

                      {PERIODOS.map((periodo) => (

                        <option key={periodo} value={periodo}>{periodo}</option>

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

                        <option key={forma} value={forma}>{forma}</option>

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

                  {success}

                </div>

              )}



              <div className="flex flex-wrap gap-3 pb-2">

                <button

                  type="submit"

                  disabled={saving}

                  className="rounded-lg bg-gradient-to-r from-[#e85d6f] to-[#d44d62] px-6 py-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-white transition hover:brightness-105 disabled:opacity-60"

                >

                  {saving ? "Salvando..." : "Salvar alterações"}

                </button>

                <button

                  type="button"

                  onClick={onClose}

                  className="rounded-lg border border-white/15 px-6 py-2.5 text-[0.75rem] font-medium text-white/70 transition hover:border-[#e85d6f]/40 hover:text-white"

                >

                  Cancelar

                </button>

              </div>

            </form>

          )}

        </div>

      </div>

    </div>

  );

}



function FormSection({ title, children }: { title: string; children: React.ReactNode }) {

  return (

    <section className="rounded-xl border border-white/10 bg-white/[0.05] p-5 md:p-6">

      <h3 className="mb-5 border-b border-white/10 pb-3 text-[0.8rem] font-bold uppercase tracking-wide text-white">

        {title}

      </h3>

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


