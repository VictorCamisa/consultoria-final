

## Diagnóstico

**Causa raiz**: Números de telefone brasileiros com o **9º dígito**. O WhatsApp às vezes envia o JID sem o 9 (ex: `553591785585`) enquanto o sistema armazena com o 9 (ex: `5535991785585`). 

O log confirma: `[webhook] Número desconhecido: 553591785585` — é a Juliana F. Pinto cujo `remote_jid` salvo é `5535991785585@s.whatsapp.net`.

O matching falha em ambas as camadas:
1. **remote_jid exato** → `553591785585@s.whatsapp.net` ≠ `5535991785585@s.whatsapp.net`
2. **phone filter** → `buildPhoneMatchFilter` não gera variantes com/sem o 9º dígito

## Solução

Corrigir o `buildPhoneMatchFilter` em `instance-resolver.ts` para gerar variantes brasileiras com e sem o 9º dígito. Também adicionar matching por `remote_jid` com variantes no webhook.

## Mudanças

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/_shared/instance-resolver.ts` | `buildPhoneMatchFilter` gera variantes com/sem 9º dígito para celulares BR |
| `supabase/functions/whatsapp-webhook/index.ts` | Match `remote_jid` com variantes (com/sem 9º dígito) antes do fallback por phone |

### Detalhe técnico

No `buildPhoneMatchFilter`, para números brasileiros (começando com 55), gerar variantes:
- Se o número local tem 9 dígitos (celular com 9): adicionar variante sem o 9 → `55 + DDD + 8 dígitos`
- Se o número local tem 8 dígitos (celular sem 9): adicionar variante com o 9 → `55 + DDD + 9 + 8 dígitos`

```typescript
// Exemplo: rawPhone = "553591785585" (sem 9)
// DDD = 35, local = 91785585 (8 dígitos)
// Variante com 9: 5535991785585
// Isso faz match com whatsapp = "+5535991785585"
```

No webhook, antes do match exato por `remote_jid`, também tentar as variantes de JID:
```typescript
const jidCandidates = buildJidVariants(remoteJid); // gera com/sem 9
// Query: .in("remote_jid", jidCandidates)
```

Isso resolve o problema de forma genérica para **todos** os números brasileiros, não só este caso específico.

