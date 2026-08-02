/**
 * Credenciais Asaas (EasyPanel / .env).
 *
 * Conta master OPPI Fit:
 * - ASAAS_API_KEY          → chave da conta principal (produção ou sandbox)
 * - ASAAS_ENV              → "sandbox" | "production"
 * - ASAAS_WALLET_ID        → wallet da OPPI Fit (receber split da taxa)
 * - ASAAS_WEBHOOK_TOKEN    → token para validar webhooks (opcional mas recomendado)
 *
 * Por academia (gravado no Tenant após criar subconta):
 * - asaasAccountId / asaasWalletId
 */

export type AsaasEnv = "sandbox" | "production";

export function getAsaasEnv(): AsaasEnv {
  const raw = (process.env.ASAAS_ENV || "sandbox").trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function getAsaasBaseUrl(): string {
  return getAsaasEnv() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

export function getAsaasApiKey(): string | null {
  const key = process.env.ASAAS_API_KEY?.trim();
  return key || null;
}

export function getAsaasPlatformWalletId(): string | null {
  const id = process.env.ASAAS_WALLET_ID?.trim();
  return id || null;
}

export function isAsaasConfigured(): boolean {
  return Boolean(getAsaasApiKey() && getAsaasPlatformWalletId());
}

export function asaasSetupChecklist(): string[] {
  const missing: string[] = [];
  if (!getAsaasApiKey()) missing.push("ASAAS_API_KEY");
  if (!getAsaasPlatformWalletId()) missing.push("ASAAS_WALLET_ID");
  if (!process.env.ASAAS_ENV?.trim()) missing.push("ASAAS_ENV (sandbox|production)");
  return missing;
}
