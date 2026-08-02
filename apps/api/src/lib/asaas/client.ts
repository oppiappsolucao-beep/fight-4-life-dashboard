import {
  getAsaasApiKey,
  getAsaasBaseUrl,
  isAsaasConfigured,
} from "./config.js";

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

export async function asaasRequest<T>(
  path: string,
  init?: RequestInit & { apiKey?: string },
): Promise<T> {
  const apiKey = init?.apiKey ?? getAsaasApiKey();
  if (!apiKey) {
    throw new AsaasError("Asaas não configurado (ASAAS_API_KEY).", 503, null);
  }

  const { apiKey: _ignored, ...rest } = init ?? {};
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(rest.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body &&
      "errors" in body &&
      Array.isArray((body as { errors: Array<{ description?: string }> }).errors)
        ? (body as { errors: Array<{ description?: string }> }).errors
            .map((item) => item.description)
            .filter(Boolean)
            .join("; ") || `Asaas HTTP ${response.status}`
        : `Asaas HTTP ${response.status}`;
    throw new AsaasError(message, response.status, body);
  }

  return body as T;
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
