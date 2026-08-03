import {
  getAsaasApiKey,
  getAsaasBaseUrl,
  getAsaasEnv,
  isAsaasConfigured,
  type AsaasEnv,
} from "./config.js";

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly url?: string,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

/**
 * Normaliza a chave Asaas.
 * Preferir ASAAS_API_KEY_B64 no EasyPanel (evita $ e = corrompidos).
 * Em texto: cole sem `$` → `aact_prod_...` (o `$` é adicionado aqui).
 */
export function normalizeAsaasApiKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let key = raw.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  // Remove BOM / espaços / quebras (paste do painel)
  key = key.replace(/^\uFEFF/, "").replace(/\s+/g, "");

  // Remove cifrões iniciais (EasyPanel $$ / $)
  key = key.replace(/^\$+/, "");

  const idx = key.search(/aact_(prod|hmlg)_/);
  if (idx < 0) return null;

  // Pega do aact_ até o fim (chaves Asaas têm : e = no meio/fim)
  const body = key.slice(idx).replace(/[^A-Za-z0-9+/=:_-]+$/g, "");
  if (!/^aact_(prod|hmlg)_/.test(body) || body.length < 40) return null;

  return `$${body}`;
}

function safeKeyPrefix(value: string, max = 22): string {
  if (!value) return "(vazio)";
  const head = value.slice(0, max);
  return value.length > max ? `${head}…` : head;
}

export function describeAsaasApiKey(raw: string | null | undefined): {
  present: boolean;
  length: number;
  rawLength: number;
  format:
    | "production"
    | "sandbox"
    | "unexpected"
    | "empty"
    | "mangled_by_env";
  preview: string;
  rawPrefix: string;
  rawStartsWithDollar: boolean;
  dollarCountAtStart: number;
  likelyEnvInterpolation: boolean;
  keyTooShort: boolean;
} {
  const rawTrimmed = (raw ?? "").trim();
  let dollarCountAtStart = 0;
  for (const ch of rawTrimmed) {
    if (ch === "$") dollarCountAtStart += 1;
    else break;
  }

  const hasTokenBody =
    rawTrimmed.includes("aact_prod_") || rawTrimmed.includes("aact_hmlg_");

  // Docker/EasyPanel: `$aact_prod_ABC...` vira variável → some o prefixo.
  const likelyEnvInterpolation = Boolean(rawTrimmed) && !hasTokenBody;

  const key = normalizeAsaasApiKey(raw);
  if (!key) {
    return {
      present: false,
      length: 0,
      rawLength: rawTrimmed.length,
      format: likelyEnvInterpolation ? "mangled_by_env" : "empty",
      preview: "",
      rawPrefix: safeKeyPrefix(rawTrimmed),
      rawStartsWithDollar: rawTrimmed.startsWith("$"),
      dollarCountAtStart,
      likelyEnvInterpolation,
      keyTooShort: rawTrimmed.length > 0 && rawTrimmed.length < 40,
    };
  }

  let format: ReturnType<typeof describeAsaasApiKey>["format"] = "unexpected";
  if (key.startsWith("$aact_prod_")) format = "production";
  else if (key.startsWith("$aact_hmlg_")) format = "sandbox";

  const preview =
    key.length <= 18 ? `${key.slice(0, 6)}…` : `${key.slice(0, 12)}…${key.slice(-4)}`;

  return {
    present: true,
    length: key.length,
    rawLength: rawTrimmed.length,
    format,
    preview,
    rawPrefix: safeKeyPrefix(rawTrimmed),
    rawStartsWithDollar: rawTrimmed.startsWith("$"),
    dollarCountAtStart,
    likelyEnvInterpolation: false,
    keyTooShort: key.length < 40,
  };
}

function summarizeAsaasBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === "string") {
    return body.slice(0, 240);
  }
  try {
    return JSON.stringify(body).slice(0, 240);
  } catch {
    return String(body).slice(0, 240);
  }
}

export async function asaasRequest<T>(
  path: string,
  init?: RequestInit & { apiKey?: string; asaasEnv?: AsaasEnv },
): Promise<T> {
  const apiKey = normalizeAsaasApiKey(init?.apiKey ?? getAsaasApiKey());
  if (!apiKey) {
    throw new AsaasError("Asaas não configurado (ASAAS_API_KEY).", 503, null);
  }

  const env = init?.asaasEnv ?? getAsaasEnv();
  const { apiKey: _ignored, asaasEnv: _env, headers: initHeaders, body, ...rest } =
    init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getAsaasBaseUrl(env)}${normalizedPath}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": `OppiFit/1.0 (Node.js; ${env})`,
    access_token: apiKey,
  };

  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...rest,
    method,
    headers: {
      ...headers,
      ...(initHeaders as Record<string, string> | undefined),
    },
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const fromErrors =
      typeof parsed === "object" &&
      parsed &&
      "errors" in parsed &&
      Array.isArray((parsed as { errors: Array<{ description?: string; code?: string }> }).errors)
        ? (parsed as { errors: Array<{ description?: string; code?: string }> }).errors
            .map((item) => item.description || item.code)
            .filter(Boolean)
            .join("; ")
        : "";

    const hint =
      response.status === 404
        ? " — endpoint/ambiente; confira ASAAS_ENV e redeploy com código novo"
        : response.status === 401
          ? " — chave inválida ou de outro ambiente (produção: aact_prod_ / sandbox: aact_hmlg_)"
          : response.status === 403
            ? " — forbidden (User-Agent ou body em GET)"
            : "";

    throw new AsaasError(
      (fromErrors || `Asaas HTTP ${response.status}`) + hint,
      response.status,
      parsed ?? summarizeAsaasBody(text),
      url,
    );
  }

  return parsed as T;
}

export function assertAsaasReady(): void {
  if (!isAsaasConfigured()) {
    throw new AsaasError(
      "Configure ASAAS_API_KEY e ASAAS_WALLET_ID no ambiente.",
      503,
      null,
    );
  }
}
