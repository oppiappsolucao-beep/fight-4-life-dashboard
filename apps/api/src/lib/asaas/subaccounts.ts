/**
 * Criação / vínculo de subconta Asaas por academia.
 * Cobranças usam a chave master + split para o wallet da academia.
 */

import { prisma } from "../prisma.js";
import { asaasRequest, AsaasError } from "./client.js";
import { getAsaasWebhookToken, isAsaasConfigured } from "./config.js";
import { brandingToForm } from "../../modules/dev/academy.js";

export type AsaasSubaccountResult = {
  accountId: string;
  walletId: string;
};

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function publicWebhookUrl(): string | null {
  const base =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    "https://academia.oppifit.com.br";
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/api/webhooks/asaas`;
}

export async function createAsaasSubaccountForTenant(
  tenantId: string,
): Promise<AsaasSubaccountResult> {
  if (!isAsaasConfigured()) {
    throw new AsaasError(
      "Asaas não configurado (ASAAS_API_KEY / ASAAS_WALLET_ID).",
      503,
      null,
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      branding: true,
      subdomain: true,
      asaasAccountId: true,
      asaasWalletId: true,
    },
  });

  if (!tenant) {
    throw new Error("Academia não encontrada.");
  }

  if (tenant.asaasAccountId && tenant.asaasWalletId) {
    return {
      accountId: tenant.asaasAccountId,
      walletId: tenant.asaasWalletId,
    };
  }

  const form = brandingToForm(tenant.branding, tenant.name, {
    subdominio: tenant.subdomain,
  });

  const cpfCnpj = digitsOnly(form.cnpj);
  const postalCode = digitsOnly(form.cep);
  const phone = digitsOnly(form.telefoneComercial || form.telefoneResponsavel);
  const mobilePhone = digitsOnly(form.telefoneResponsavel || form.telefoneComercial);

  if (!cpfCnpj || cpfCnpj.length < 11) {
    throw new AsaasError(
      "CNPJ/CPF da academia inválido para criar subconta Asaas.",
      400,
      null,
    );
  }
  if (!postalCode || postalCode.length < 8) {
    throw new AsaasError(
      "CEP da academia é obrigatório para criar subconta Asaas.",
      400,
      null,
    );
  }
  if (!form.rua?.trim() || !form.numero?.trim() || !form.bairro?.trim()) {
    throw new AsaasError(
      "Endereço completo da academia é obrigatório para subconta Asaas (rua, número, bairro).",
      400,
      null,
    );
  }

  const webhookToken = getAsaasWebhookToken();
  const webhookUrl = publicWebhookUrl();

  const body: Record<string, unknown> = {
    name: form.razaoSocial || form.nomeFantasia || tenant.name,
    email: form.emailCorporativo,
    cpfCnpj,
    companyType: cpfCnpj.length > 11 ? "LIMITED" : undefined,
    phone: phone || undefined,
    mobilePhone: mobilePhone || phone || undefined,
    address: form.rua.trim(),
    addressNumber: form.numero.trim(),
    province: form.bairro.trim(),
    postalCode,
    incomeValue: 5000,
  };

  if (webhookUrl && webhookToken) {
    body.webhooks = [
      {
        name: "OPPI Fit cobranças",
        url: webhookUrl,
        email: form.emailCorporativo,
        sendType: "SEQUENTIALLY",
        interrupted: false,
        enabled: true,
        apiVersion: 3,
        authToken: webhookToken,
        events: [
          "PAYMENT_CREATED",
          "PAYMENT_UPDATED",
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
          "PAYMENT_OVERDUE",
          "PAYMENT_DELETED",
        ],
      },
    ];
  }

  const created = await asaasRequest<{
    id?: string;
    walletId?: string;
    apiKey?: string;
  }>("/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const accountId = created.id?.trim();
  const walletId = created.walletId?.trim();

  if (!accountId || !walletId) {
    throw new AsaasError(
      "Asaas criou a subconta sem id/walletId na resposta.",
      502,
      created,
    );
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      asaasAccountId: accountId,
      asaasWalletId: walletId,
    },
  });

  return { accountId, walletId };
}

/** Tenta criar se ainda não houver; não falha o cadastro da academia se Asaas estiver off. */
export async function ensureAsaasSubaccountQuiet(
  tenantId: string,
): Promise<{ ok: true; result: AsaasSubaccountResult } | { ok: false; error: string }> {
  try {
    const result = await createAsaasSubaccountForTenant(tenantId);
    return { ok: true, result };
  } catch (error) {
    const message =
      error instanceof AsaasError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha ao criar subconta Asaas.";
    return { ok: false, error: message };
  }
}
