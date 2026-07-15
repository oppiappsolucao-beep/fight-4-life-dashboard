import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { authRoutes } from "./modules/auth/routes.js";
import { devRoutes } from "./modules/dev/routes.js";

// EasyPanel injeta PORT (muitas vezes 80). Não force 3000 no painel —
// a Porta do serviço deve ser a mesma deste valor.
const PORT = Number(process.env.PORT || 3000);
// "" é truthy para ??, mas inválido para listen — usar ||.
const HOST = process.env.HOST || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: JWT_SECRET,
});

app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes, { prefix: "/api" });
await app.register(devRoutes, { prefix: "/api" });

// Em produção, servimos o front (Vite build) pelo mesmo servidor/domínio.
const currentDir = dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST_PATH
  ? resolve(process.env.WEB_DIST_PATH)
  : resolve(currentDir, "../../web/dist");

if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith("/api")) {
      reply.code(404).send({ error: "Rota não encontrada" });
      return;
    }
    return reply.sendFile("index.html");
  });
} else {
  // Sem o dist do front, ainda responde na raiz (health check / proxy).
  app.get("/", async () => ({
    status: "ok",
    message: "API no ar. Front estático não encontrado (WEB_DIST_PATH).",
  }));
}

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`API rodando em http://${HOST}:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
