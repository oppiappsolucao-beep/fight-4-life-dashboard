# Asaas — o que configurar na conta master OPPI Fit

## Variáveis no EasyPanel (serviço `academia`)

| Variável | Onde pegar |
|----------|------------|
| `ASAAS_API_KEY` | Asaas → Integrações → Chave de API |
| `ASAAS_ENV` | `sandbox` ou `production` |
| `ASAAS_WALLET_ID` | ID da carteira da conta master (receber split da taxa) |
| `ASAAS_WEBHOOK_TOKEN` | Token opcional para validar webhook |

## Modelo de negócio (já codificado)

- Taxa **por academia**, no **mês da academia** (aniversário do cadastro).
- Só conta cobrança **PAGA** (não emitida).
- 1ª–100ª paga no ciclo → **R$ 1,90**
- 101ª+ paga no ciclo → **R$ 1,49**
- Menor de 18 → pagador = **responsável** (obrigatório).

## Próximos passos da integração

1. Colar as variáveis acima no EasyPanel e redeploy.
2. Criar subconta Asaas por academia (`asaasAccountId` / `asaasWalletId` no Tenant).
3. Webhook `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → `confirmStudentChargePaid`.
4. Split: valor academia − taxa OPPI → wallet da academia; taxa → `ASAAS_WALLET_ID`.
