# Inicia o ambiente de desenvolvimento Oppi Tech Dashboard
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# Corrige erro de certificado SSL em algumas redes Windows
$env:NODE_OPTIONS = "--use-system-ca"

Write-Host "=== Oppi Tech Dashboard - Dev Setup ===" -ForegroundColor Cyan
Set-Location $Root

# 1. Dependencias
if (-not (Test-Path "$Root\node_modules")) {
    Write-Host "`n[1/5] Instalando dependencias (pode demorar alguns minutos)..." -ForegroundColor Yellow
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install falhou." }
} else {
    Write-Host "`n[1/5] Dependencias ja instaladas." -ForegroundColor Green
}

# 2. .env
if (-not (Test-Path "$Root\apps\api\.env")) {
    Write-Host "`n[2/5] Criando apps/api/.env a partir do exemplo..." -ForegroundColor Yellow
    Copy-Item "$Root\apps\api\.env.example" "$Root\apps\api\.env"
    Write-Host "ATENCAO: Edite apps/api/.env com suas credenciais Neon antes de continuar." -ForegroundColor Red
    exit 1
}
Write-Host "`n[2/5] .env encontrado." -ForegroundColor Green

# 3. PostgreSQL local (Docker) - opcional
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
    Write-Host "`n[3/5] Subindo PostgreSQL local via Docker..." -ForegroundColor Yellow
    docker compose up -d
} else {
    Write-Host "`n[3/5] Docker nao encontrado - usando banco do .env (Neon)." -ForegroundColor Yellow
}

# 4. Banco
Write-Host "`n[4/5] Sincronizando schema e seed..." -ForegroundColor Yellow
npm run db:push
if ($LASTEXITCODE -ne 0) { throw "db:push falhou. Verifique DATABASE_URL no .env" }
npm run db:seed

# 5. Servidores
Write-Host "`n[5/5] Iniciando API (3001) + Frontend (5173)..." -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "API:      http://localhost:3001/health" -ForegroundColor Cyan
npm run dev
