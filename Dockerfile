# Preferência no EasyPanel: Builder = Dockerfile
# Se o painel usar Nixpacks, usa o nixpacks.toml
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

COPY . .

RUN npm run db:generate -w @oppi/api \
  && npm run build -w @oppi/web \
  && npm run build -w @oppi/api

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV WEB_DIST_PATH=/app/apps/web/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
