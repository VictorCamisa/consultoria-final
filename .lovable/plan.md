

## Diagnóstico

Atualmente **não existe** nenhum toggle no sistema para ativar/desativar a IA de resposta automática. O auto-reply está sempre ligado no webhook — a única condição que o bloqueia é se houve uma mensagem de saída nos últimos 30 segundos (anti-duplicata).

## Solução

Adicionar uma coluna `ia_auto_reply` (boolean) na tabela `consultoria_config` e um toggle visual na página de Configurações. O webhook consultará esse flag antes de disparar o auto-reply.

## Mudanças

| Local | O que muda |
|-------|-----------|
| **Migração SQL** | `ALTER TABLE consultoria_config ADD COLUMN ia_auto_reply boolean NOT NULL DEFAULT true` |
| **`whatsapp-webhook/index.ts`** | Na query de config (linha ~350), incluir `ia_auto_reply` e checar antes do auto-reply |
| **`src/pages/Configuracoes.tsx`** | Adicionar um Switch (toggle) por nicho para ligar/desligar a IA, salvando via `consultoria_config` |

### Detalhe técnico

No webhook, a seção AUTO-REPLY (linha 342) passará a verificar:
```typescript
const { data: config } = await supabase
  .from("consultoria_config")
  .select("horario_inicio, horario_fim, ia_auto_reply")
  .ilike("nicho", prospect.nicho)
  .maybeSingle();

if (config?.ia_auto_reply === false) {
  console.log(`[webhook] Auto-reply desativado para nicho ${prospect.nicho}`);
  return;
}
```

Na página de Configurações, cada card de nicho exibirá um Switch "IA Auto-Reply" que atualiza `ia_auto_reply` no banco.

