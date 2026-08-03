/**
 * Criação / vínculo de subconta Asaas por academia.
 * Cobranças são emitidas com a apiKey da subconta (nome da academia na fatura).
 */

import { prisma } from "../prisma.js";
import { asaasRequest, AsaasError, normalizeAsaasApiKey } from "./client.js";
import { getAsaasWebhookToken, isAsaasConfigured } from "./config.js";
import { brandingToForm } from "../../modules/dev/academy.js";

export type AsaasSubaccountResult = {
  accountId: string;
  walletId: string;
  apiKey: string;
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
  options?: { force?: boolean },
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
      slug: true,
      asaasAccountId: true,
      asaasWalletId: true,
      asaasApiKey: true,
    },
  });

  if (!tenant) {
    throw new Error("Academia não encontrada.");
  }

  const existingKey = normalizeAsaasApiKey(tenant.asaasApiKey);
  if (
    !options?.force &&
    tenant.asaasAccountId &&
    tenant.asaasWalletId &&
    existingKey
  ) {
    return {
      accountId: tenant.asaasAccountId,
      walletId: tenant.asaasWalletId,
      apiKey: existingKey,
    };
  }

  if (
    !options?.force &&
    tenant.asaasAccountId &&
    tenant.asaasWalletId &&
    !existingKey
  ) {
    throw new AsaasError(
      "Subconta já vinculada, mas sem chave de API salva (o Asaas só devolve a chave na criação). Cole a chave da subconta no painel Dev ou force uma nova vinculação.",
      400,
      null,
    );
  }

  if (options?.force) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        asaasAccountId: null,
        asaasWalletId: null,
        asaasApiKey: null,
      },
    });
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
  // E-mail único por academia evita colisão ao recriar subconta
  const accountEmail =
    form.emailCorporativo.includes("+")
      ? form.emailCorporativo
      : form.emailCorporativo.replace(
          "@",
          `+${(tenant.subdomain || tenant.slug).replace(/[^a-z0-9]/gi, "")}@`,
        );

  const displayName =
    form.nomeFantasia?.trim() || form.razaoSocial?.trim() || tenant.name;

  const body: Record<string, unknown> = {
    name: displayName,
    email: accountEmail,
    loginEmail: accountEmail,
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
    accessToken?: string;
  }>("/accounts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const accountId = created.id?.trim();
  const walletId = created.walletId?.trim();
  const apiKey = normalizeAsaasApiKey(created.apiKey || created.accessToken);

  if (!accountId || !walletId) {
    throw new AsaasError(
      "Asaas criou a subconta sem id/walletId na resposta.",
      502,
      created,
    );
  }
  if (!apiKey) {
    throw new AsaasError(
      "Asaas criou a subconta sem apiKey. Não será possível emitir cobranças no nome da academia.",
      502,
      created,
    );
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      asaasAccountId: accountId,
      asaasWalletId: walletId,
      asaasApiKey: apiKey,
    },
  });

  return { accountId, walletId, apiKey };
}

/** Salva a chave de uma subconta já existente (quando a criação anterior não guardou a key). */
export async function saveTenantAsaasApiKey(
  tenantId: string,
  rawApiKey: string,
): Promise<AsaasSubaccountResult> {
  const apiKey = normalizeAsaasApiKey(rawApiKey);
  if (!apiKey) {
    throw new AsaasError("Chave de API inválida.", 400, null);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { asaasAccountId: true, asaasWalletId: true },
  });
  if (!tenant?.asaasAccountId || !tenant.asaasWalletId) {
    throw new Error(
      "Vincule a subconta Asaas antes de colar a chave (ou force uma nova criação).",
    );
  }

  // Valida a chave com um ping simples na subconta
  await asaasRequest("/customers?limit=1", { apiKey });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { asaasApiKey: apiKey },
  });

  return {
    accountId: tenant.asaasAccountId,
    walletId: tenant.asaasWalletId,
    apiKey,
  };
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

export type AsaasOnboardingDocument = {
  id: string | null;
  type: string | null;
  title: string | null;
  status: string | null;
  onboardingUrl: string | null;
  onboardingUrlExpirationDate: string | null;
};

export type AsaasOnboardingInfo = {
  accountStatus: string | null;
  commercialInfoStatus: string | null;
  documents: AsaasOnboardingDocument[];
  primaryOnboardingUrl: string | null;
  pendingCount: number;
};

/** Busca status + links de onboarding da subconta (chave da academia). */
export async function getTenantAsaasOnboarding(
  tenantId: string,
): Promise<AsaasOnboardingInfo> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      asaasAccountId: true,
      asaasWalletId: true,
      asaasApiKey: true,
      name: true,
    },
  });

  if (!tenant) {
    throw new Error("Academia não encontrada.");
  }

  const apiKey = normalizeAsaasApiKey(tenant.asaasApiKey);
  if (!apiKey) {
    throw new AsaasError(
      "Subconta sem apiKey salva. Vincule/cole a chave da subconta no Dev antes de gerar o link.",
      400,
      null,
    );
  }

  let accountStatus: string | null = null;
  let commercialInfoStatus: string | null = null;
  try {
    const status = await asaasRequest<{
      general?: string;
      commercialInfo?: string;
      documentation?: string;
    }>("/myAccount/status/", { apiKey });
    accountStatus = status.general ?? status.documentation ?? null;
    commercialInfoStatus = status.commercialInfo ?? null;
  } catch {
    // endpoint pode variar; documentos bastam
  }

  const docsResponse = await asaasRequest<{
    data?: Array<{
      id?: string;
      type?: string;
      title?: string;
      status?: string;
      onboardingUrl?: string;
      onboardingUrlExpirationDate?: string;
      documents?: Array<{
        id?: string;
        type?: string;
        title?: string;
        status?: string;
        onboardingUrl?: string;
        onboardingUrlExpirationDate?: string;
      }>;
    }>;
  }>("/myAccount/documents", { apiKey });

  const documents: AsaasOnboardingDocument[] = [];
  for (const group of docsResponse.data ?? []) {
    const nested = group.documents?.length ? group.documents : [group];
    for (const doc of nested) {
      documents.push({
        id: doc.id ?? group.id ?? null,
        type: doc.type ?? group.type ?? null,
        title: doc.title ?? group.title ?? null,
        status: doc.status ?? group.status ?? null,
        onboardingUrl: doc.onboardingUrl ?? group.onboardingUrl ?? null,
        onboardingUrlExpirationDate:
          doc.onboardingUrlExpirationDate ?? group.onboardingUrlExpirationDate ?? null,
      });
    }
  }

  const withLink = documents.filter((item) => Boolean(item.onboardingUrl));
  const pending = documents.filter((item) => {
    const status = (item.status ?? "").toUpperCase();
    return status === "PENDING" || status === "REJECTED" || !status;
  });

  const primaryOnboardingUrl =
    withLink.find((item) => (item.status ?? "").toUpperCase() === "PENDING")
      ?.onboardingUrl ??
    withLink[0]?.onboardingUrl ??
    null;

  return {
    accountStatus,
    commercialInfoStatus,
    documents,
    primaryOnboardingUrl,
    pendingCount: pending.length,
  };
}
