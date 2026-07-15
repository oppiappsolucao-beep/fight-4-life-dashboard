# Imagem única: build do front (Vite) + build da API (Fastify) e execução da API,
# que também serve o site estático. Ideal para deploy no EasyPanel com 1 serviço.
FROM node:20-slim

# openssl é necessário para o Prisma gerar/usar o query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências de todos os workspaces (usa o cache quando possível)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

# Copia o restante do código
COPY . .

# Gera o Prisma Client e builda front + API
RUN npm run db:generate -w @oppi/api \
  && npm run build -w @oppi/web \
  && npm run build -w @oppi/api

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV WEB_DIST_PATH=/app/apps/web/dist

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@oppi/api"]
