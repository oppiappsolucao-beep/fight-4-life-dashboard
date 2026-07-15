import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const academyFieldsSchema = z.object({
  razaoSocial: z.string().min(1),
  nomeFantasia: z.string().min(1),
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
});

export const academyCreateSchema = academyFieldsSchema.extend({
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
});

export const academyUpdateSchema = academyFieldsSchema.extend({
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres.").optional(),
  active: z.boolean(),
});

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
  };
}

export function brandingToForm(
  branding: unknown,
  tenantName: string,
): AcademyFields {
  const data = (branding ?? {}) as BrandingJson;
  const endereco = data.endereco ?? {};
  const responsavel = data.responsavel ?? {};
  const plano = data.plano ?? {};

  return {
    razaoSocial: data.razaoSocial ?? "",
    nomeFantasia: tenantName,
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
  };
}

export function parseBilling(branding: unknown) {
  const data = (branding ?? {}) as BrandingJson;
  const plano = data.plano ?? {};

  return {
    plano: plano.nome ?? "",
    periodo: plano.periodo ?? "",
    formaPagamento: plano.formaPagamento ?? "",
  };
}

export function formToBranding(
  data: AcademyFields,
  emailLogin: string,
): Prisma.InputJsonObject {
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
    },
  };
}
