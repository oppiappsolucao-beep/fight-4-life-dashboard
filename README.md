# Oppi Tech Dashboard

Dashboard SaaS para gestão de academias de artes marciais.

## Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Fastify + Prisma
- **Banco:** PostgreSQL (Neon)

## Estrutura

```
apps/
  api/    → Backend Node.js
  web/    → Frontend React
app.py    → App Streamlit legado (será descontinuado)
```

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco Neon

Copie `apps/api/.env.example` para `apps/api/.env` e preencha com as connection strings do Neon:

- **Connection pooling ON** → `DATABASE_URL`
- **Connection pooling OFF** → `DIRECT_URL`

### 3. Criar tabelas e seed

```bash
npm run db:push
npm run db:seed
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

### 5. Imagens da tela de login

Copie para `apps/web/public/`:

- `oppi_logo.png`
- `muaythai.png`
- `jiujitsu.png`
- `jiujitsukids.png`
- `mma.png`

## Usuários de teste (seed)

| E-mail | Senha | Perfil |
|--------|-------|--------|
| admin@oppitech.com.br | admin123 | ADMIN |
| comercial@oppitech.com.br | comercial123 | COMERCIAL |
| diretoria@oppitech.com.br | diretoria123 | DIRETORIA |

## Troubleshooting

### ERR_CONNECTION_REFUSED em localhost:3001 ou localhost:5173

Isso significa que **os servidores não estão rodando**. Siga estes passos no terminal (PowerShell), na pasta do projeto:

```powershell
# 1. Instalar dependências (obrigatório — sem isso nada sobe)
$env:NODE_OPTIONS="--use-system-ca"
npm install

# 2. Configurar banco (se ainda não fez)
copy apps\api\.env.example apps\api\.env
# Edite apps\api\.env com as strings do Neon

# 3. Criar tabelas
npm run db:push
npm run db:seed

# 4. Subir API + Frontend
npm run dev
```

**URLs corretas:**
- **App (login):** http://localhost:5173 ← abra esta no navegador
- **API (health check):** http://localhost:3001/health ← só para testar se a API está viva

Ou use o script automático:

```powershell
.\scripts\start-dev.ps1
```

### npm error UNABLE_TO_VERIFY_LEAF_SIGNATURE

Se o `npm install` falhar com erro de certificado SSL, rode antes:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm install
```

Isso costuma ocorrer em redes com proxy/antivírus que interceptam HTTPS. Alternativa (menos segura):

```powershell
npm config set strict-ssl false
npm install
npm config set strict-ssl true
```

### Banco local com Docker (alternativa ao Neon)

Se tiver Docker instalado:

```powershell
docker compose up -d
```

O `.env` já pode usar `localhost:5432` (veja `docker-compose.yml`).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | API + Web em paralelo |
| `npm run dev:api` | Só backend |
| `npm run dev:web` | Só frontend |
| `npm run db:push` | Sincroniza schema no Neon |
| `npm run db:seed` | Cria tenant Oppi Tech + usuários |
| `npm run db:studio` | UI visual do banco |
