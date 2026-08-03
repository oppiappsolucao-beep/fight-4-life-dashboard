/**
 * Credenciais Asaas (EasyPanel / .env).
 *
 * Conta master OPPI Fit:
 * - ASAAS_API_KEY          → preferir SEM cifrão: aact_prod_... (o código adiciona $)
 * - ASAAS_API_KEY_B64      → alternativa: chave completa em Base64 (evita bug do $ no EasyPanel)
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

export function getAsaasBaseUrl(env: AsaasEnv = getAsaasEnv()): string {
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

/** Lê a chave crua do env (ainda sem normalizar). */
export function getAsaasApiKeyRaw(): string | null {
  const b64 = process.env.ASAAS_API_KEY_B64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8").trim();
      if (decoded) return decoded;
    } catch {
      // ignora e tenta ASAAS_API_KEY
    }
  }

  const key = process.env.ASAAS_API_KEY?.trim();
  return key || null;
}

export function getAsaasApiKey(): string | null {
  return getAsaasApiKeyRaw();
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
  if (!getAsaasApiKey()) missing.push("ASAAS_API_KEY (ou ASAAS_API_KEY_B64)");
  if (!getAsaasPlatformWalletId()) missing.push("ASAAS_WALLET_ID");
  if (!process.env.ASAAS_ENV?.trim()) missing.push("ASAAS_ENV (sandbox|production)");
  return missing;
}
