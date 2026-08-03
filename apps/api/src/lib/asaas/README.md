# Asaas — o que configurar na conta master OPPI Fit

## Variáveis no EasyPanel (serviço `academia`)

| Variável | Onde pegar |
|----------|------------|
| `ASAAS_API_KEY` | Asaas → Integrações → Chave de API. **No EasyPanel cole SEM `$`**: `aact_prod_...` |
| `ASAAS_ENV` | `sandbox` ou `production` |
| `ASAAS_WALLET_ID` | ID da carteira da conta master (receber split da taxa) |
| `ASAAS_WEBHOOK_TOKEN` | Token opcional para validar webhook |

### Importante (EasyPanel) — use Base64

O EasyPanel corrompe `$` e às vezes corta chaves longas com `=`.

**Método recomendado (PowerShell no Windows):**

1. Gere uma chave nova em https://www.asaas.com (Produção → Integrações)
2. No PowerShell (troque pela chave completa **com** o `$`):

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('$aact_prod_COLE_A_CHAVE_INTEIRA_AQUI'))
```

3. No EasyPanel, apague `ASAAS_API_KEY` e coloque:

```env
ASAAS_API_KEY_B64=cole_o_resultado_do_powershell
ASAAS_ENV=production
ASAAS_WALLET_ID=seu-uuid-da-carteira
```

4. Implantar → Testar conexão Asaas

## Modelo de negócio (já codificado)

- Taxa **por academia**, no **mês da academia** (aniversário do cadastro).
- Só conta cobrança **PAGA** (não emitida).
- 1ª–100ª paga no ciclo → **R$ 1,90**
- 101ª+ paga no ciclo → **R$ 1,49**
- Menor de 18 → pagador = **responsável** (obrigatório).

## Próximos passos da integração

1. Colar as variáveis acima no EasyPanel e redeploy.
2. Criar subconta Asaas por academia (`asaasAccountId` / `asaasWalletId` no Tenant) — automático no cadastro Dev + botão retry.
3. Webhook `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → `confirmStudentChargePaid`.
4. Split: valor academia − taxa OPPI → wallet da academia; taxa → fica na master.

### Webhook (após deploy)

URL: `https://academia.oppifit.com.br/api/webhooks/asaas`  
Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`  
Token: mesmo valor de `ASAAS_WEBHOOK_TOKEN` no EasyPanel.
