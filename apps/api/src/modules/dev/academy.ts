import type { Prisma } from "@prisma/client";
import { z } from "zod";

const academyFieldsObject = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().min(1),
  /** Subdomínio desejado (ex.: dojotakeda → dojotakeda.oppifit.com.br). Opcional. */
  subdominio: z
    .string()
    .optional()
    .transform((value) => {
      const normalized = (value ?? "").trim().toLowerCase();
      return normalized || undefined;
    })
    .refine((value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
      message: "Subdomínio inválido. Use apenas letras minúsculas, números e hífen.",
    }),
  cnpj: z.string().min(1),
  inscricaoMunicipal: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  telefoneComercial: z.string().optional(),
  emailCorporativo: z.string().email(),
  nomeResponsavel: z.string().min(1),
  cpfResponsavel: z.string().min(1),
  emailLogin: z.string().email(),
  telefoneResponsavel: z.string().optional(),
  plano: z.string().min(1),
  periodo: z.string().min(1),
  formaPagamento: z.string().min(1),
  faixa: z.coerce.number().optional(),
  valor: z.coerce.number().optional(),
  planId: z.string().optional(),
  usaCatraca: z.boolean().optional(),
  catracaIp: z.string().optional(),
  catracaPorta: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return undefined;
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isInteger(parsed) ? parsed : undefined;
    }),
  catracaEquipamento: z.string().optional(),
  catracaSerie: z.string().optional(),
  catracaEdgeId: z.string().optional(),
  catracaTeclado: z.boolean().optional(),
  catracaFacial: z.boolean().optional(),
  catracaDigital: z.boolean().optional(),
});

function withCatracaRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    if (!data || typeof data !== "object" || !("usaCatraca" in data) || !data.usaCatraca) return;

    const record = data as {
      catracaIp?: string;
      catracaPorta?: number;
      catracaTeclado?: boolean;
      catracaFacial?: boolean;
      catracaDigital?: boolean;
    };
    const ip = (record.catracaIp ?? "").trim();
    if (!isIpv4(ip)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o IP da catraca. Ex.: 192.168.0.150.",
        path: ["catracaIp"],
      });
    }

    if (record.catracaPorta == null || record.catracaPorta < 1 || record.catracaPorta > 65535) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe a porta da catraca. Na Toletus, use 7878.",
        path: ["catracaPorta"],
      });
    }

    if (!record.catracaTeclado && !record.catracaFacial && !record.catracaDigital) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Marque como o aluno se identifica: teclado, facial ou digital.",
        path: ["catracaTeclado"],
      });
    }
  });
}

export const academyFieldsSchema = withCatracaRules(academyFieldsObject);

export const academyCreateSchema = withCatracaRules(
  academyFieldsObject.extend({
    senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  }),
);

export const academyUpdateSchema = withCatracaRules(
  academyFieldsObject.extend({
    senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres.").optional(),
    active: z.boolean(),
  }),
);

export type AcademyFields = z.infer<typeof academyFieldsSchema>;

interface BrandingJson {
  razaoSocial?: string;
  cnpj?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  endereco?: {
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
  telefoneComercial?: string;
  emailCorporativo?: string;
  responsavel?: {
    nome?: string;
    cpf?: string;
    telefone?: string;
    emailLogin?: string;
  };
  plano?: {
    nome?: string;
    periodo?: string;
    formaPagamento?: string;
    faixa?: number;
    valor?: number;
    planId?: string;
  };
  catraca?: {
    usa?: boolean;
    ip?: string;
    porta?: number;
    equipamento?: string;
    serie?: string;
    edgeId?: string;
    teclado?: boolean;
    facial?: boolean;
    digital?: boolean;
  };
}

export function brandingToForm(
  branding: unknown,
  tenantName: string,
  options?: { subdominio?: string | null },
): AcademyFields {
  const data = (branding ?? {}) as BrandingJson;
  const endereco = data.endereco ?? {};
  const responsavel = data.responsavel ?? {};
  const plano = data.plano ?? {};
  const subdominio = (options?.subdominio ?? "").trim().toLowerCase() || undefined;

  return {
    razaoSocial: data.razaoSocial ?? "",
    nomeFantasia: tenantName,
    subdominio,
    cnpj: data.cnpj ?? "",
    inscricaoMunicipal: data.inscricaoMunicipal ?? "",
    inscricaoEstadual: data.inscricaoEstadual ?? "",
    rua: endereco.rua ?? "",
    numero: endereco.numero ?? "",
    bairro: endereco.bairro ?? "",
    cidade: endereco.cidade ?? "",
    estado: endereco.estado ?? "",
    cep: endereco.cep ?? "",
    telefoneComercial: data.telefoneComercial ?? "",
    emailCorporativo: data.emailCorporativo ?? "",
    nomeResponsavel: responsavel.nome ?? "",
    cpfResponsavel: responsavel.cpf ?? "",
    emailLogin: responsavel.emailLogin ?? "",
    telefoneResponsavel: responsavel.telefone ?? "",
    plano: plano.nome ?? "",
    periodo: plano.periodo ?? "",
    formaPagamento: plano.formaPagamento ?? "",
    faixa: typeof plano.faixa === "number" ? plano.faixa : undefined,
    valor: typeof plano.valor === "number" ? plano.valor : undefined,
    planId: plano.planId ?? undefined,
    ...catracaToForm(data.catraca),
  };
}

export interface CatracaSummary {
  usa: boolean;
  ip: string;
  porta: number | null;
  equipamento: string;
  serie: string;
  edgeId: string;
  teclado: boolean;
  facial: boolean;
  digital: boolean;
}

function catracaToForm(catraca: BrandingJson["catraca"]): Pick<
  AcademyFields,
  | "usaCatraca"
  | "catracaIp"
  | "catracaPorta"
  | "catracaEquipamento"
  | "catracaSerie"
  | "catracaEdgeId"
  | "catracaTeclado"
  | "catracaFacial"
  | "catracaDigital"
> {
  return {
    usaCatraca: Boolean(catraca?.usa),
    catracaIp: catraca?.ip ?? "",
    catracaPorta: typeof catraca?.porta === "number" ? catraca.porta : undefined,
    catracaEquipamento: catraca?.equipamento ?? "",
    catracaSerie: catraca?.serie ?? "",
    catracaEdgeId: catraca?.edgeId ?? "",
    catracaTeclado: Boolean(catraca?.teclado),
    catracaFacial: Boolean(catraca?.facial),
    catracaDigital: Boolean(catraca?.digital),
  };
}

export function parseCatraca(branding: unknown): CatracaSummary {
  const data = (branding ?? {}) as BrandingJson;
  const form = catracaToForm(data.catraca);
  return {
    usa: Boolean(form.usaCatraca),
    ip: form.catracaIp ?? "",
    porta: form.catracaPorta ?? null,
    equipamento: form.catracaEquipamento ?? "",
    serie: form.catracaSerie ?? "",
    edgeId: form.catracaEdgeId ?? "",
    teclado: Boolean(form.catracaTeclado),
    facial: Boolean(form.catracaFacial),
    digital: Boolean(form.catracaDigital),
  };
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

export function parseBilling(branding: unknown) {
  const data = (branding ?? {}) as BrandingJson;
  const plano = data.plano ?? {};

  return {
    plano: plano.nome ?? "",
    periodo: plano.periodo ?? "",
    formaPagamento: plano.formaPagamento ?? "",
    faixa: typeof plano.faixa === "number" ? plano.faixa : null,
    valor: typeof plano.valor === "number" ? plano.valor : null,
    planId: plano.planId ?? "",
  };
}

export interface AcademyAsaasChargeRecord {
  customerId: string;
  paymentId: string;
  invoiceUrl: string | null;
  status: string;
  amountCents: number;
  dueDate: string;
  payerName: string;
  payerCpf: string;
  createdAt: string;
  paidAt?: string | null;
}

export function parseAsaasCharge(branding: unknown): AcademyAsaasChargeRecord | null {
  const data = (branding ?? {}) as { asaasCobranca?: Partial<AcademyAsaasChargeRecord> };
  const charge = data.asaasCobranca;
  if (!charge?.paymentId || !charge.customerId) return null;

  return {
    customerId: charge.customerId,
    paymentId: charge.paymentId,
    invoiceUrl: charge.invoiceUrl ?? null,
    status: charge.status ?? "PENDING",
    amountCents: typeof charge.amountCents === "number" ? charge.amountCents : 0,
    dueDate: charge.dueDate ?? "",
    payerName: charge.payerName ?? "",
    payerCpf: charge.payerCpf ?? "",
    createdAt: charge.createdAt ?? "",
    paidAt: charge.paidAt ?? null,
  };
}

export function brandingWithAsaasCharge(
  branding: unknown,
  charge: AcademyAsaasChargeRecord,
): Prisma.InputJsonObject {
  const current = JSON.parse(JSON.stringify(branding ?? {})) as Record<string, unknown>;
  return {
    ...current,
    asaasCobranca: { ...charge },
  } as Prisma.InputJsonObject;
}

export function formToBranding(
  data: AcademyFields,
  emailLogin: string,
  previous?: unknown,
): Prisma.InputJsonObject {
  const current = (previous && typeof previous === "object" ? previous : {}) as {
    asaasCobranca?: AcademyAsaasChargeRecord;
  };

  return {
    razaoSocial: data.razaoSocial,
    cnpj: data.cnpj,
    inscricaoMunicipal: data.inscricaoMunicipal,
    inscricaoEstadual: data.inscricaoEstadual,
    endereco: {
      rua: data.rua,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,
      cep: data.cep,
    },
    telefoneComercial: data.telefoneComercial,
    emailCorporativo: data.emailCorporativo,
    responsavel: {
      nome: data.nomeResponsavel,
      cpf: data.cpfResponsavel,
      telefone: data.telefoneResponsavel,
      emailLogin,
    },
    plano: {
      nome: data.plano,
      periodo: data.periodo,
      formaPagamento: data.formaPagamento,
      faixa: data.faixa,
      valor: data.valor,
      planId: data.planId,
    },
    catraca: data.usaCatraca
      ? {
          usa: true,
          ip: (data.catracaIp ?? "").trim(),
          porta: data.catracaPorta ?? 7878,
          equipamento: (data.catracaEquipamento ?? "").trim(),
          serie: (data.catracaSerie ?? "").trim(),
          edgeId: (data.catracaEdgeId ?? "").trim(),
          teclado: Boolean(data.catracaTeclado),
          facial: Boolean(data.catracaFacial),
          digital: Boolean(data.catracaDigital),
        }
      : { usa: false },
    ...(current.asaasCobranca
      ? { asaasCobranca: JSON.parse(JSON.stringify(current.asaasCobranca)) as Prisma.InputJsonValue }
      : {}),
  };
}
