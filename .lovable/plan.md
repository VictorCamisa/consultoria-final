

## Diagnóstico

A lógica de movimentação automática **já existe** no webhook (`whatsapp-webhook/index.ts`, linha 259-265): quando uma mensagem de entrada (`direcao: "entrada"`) chega para um prospect com status `"abordado"` ou `"em_cadencia"`, ele é automaticamente movido para `"respondeu"`.

**O problema**: A resposta da Dra. Gabriela **não chegou ao banco de dados**. Não há nenhum registro de entrada em `consultoria_conversas` para esse prospect — o webhook da Evolution API não disparou ou falhou silenciosamente. Possíveis causas:
- O webhook da instância "Danilo-prospect" não está configurado corretamente (URL incorreta ou desabilitado)
- O evento `MESSAGES_UPSERT` não está sendo enviado pela Evolution API

## Solução em 3 partes

### 1. Reconfigurar webhook automaticamente (garantir auto-move)
Adicionar na função `manage-evolution` uma action `"reconfigure_webhooks"` que re-aplica o webhook URL em todas as instâncias abertas. Também adicionar um botão em Configurações para o usuário disparar isso manualmente.

### 2. Sync + Auto-move (fallback)
No `sync-whatsapp-messages`, após sincronizar mensagens históricas, verificar se existem mensagens de entrada e o prospect ainda está em `"abordado"` ou `"em_cadencia"` — se sim, mover automaticamente para `"respondeu"`. Isso funciona como fallback caso o webhook falhe.

### 3. Manter movimentação manual
O botão de mover manualmente entre estágios (já existente no `ProspectCard`) continua funcionando normalmente para leads adicionados/abordados manualmente.

## Mudanças

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/sync-whatsapp-messages/index.ts` | Após sincronizar, verificar se prospect deve ser movido para "respondeu" (auto-move por sync) |
| `supabase/functions/manage-evolution/index.ts` | Adicionar action `reconfigure_webhooks` para re-aplicar webhook em todas instâncias |
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar também matching por `remote_jid` direto (mais confiável que só telefone) |

### Detalhe técnico do auto-move no sync

```typescript
// No final de sync-whatsapp-messages, após inserir mensagens:
if (synced > 0) {
  // Verificar se há mensagens de entrada e prospect está em estágio pré-resposta
  const hasInbound = toInsert.some(m => m.direcao === "entrada");
  if (hasInbound && ["abordado", "em_cadencia"].includes(prospect.status)) {
    await supabase.from("consultoria_prospects").update({
      status: "respondeu",
      data_ultima_interacao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", prospect_id);
  }
}
```

### Detalhe do matching por remote_jid no webhook

```typescript
// Antes do phoneMatchFilter, tentar match direto por remote_jid
const { data: jidMatch } = await supabase
  .from("consultoria_prospects")
  .select("id, nicho, status, ...")
  .eq("remote_jid", remoteJid)
  .limit(1);

// Se encontrou, usar. Senão, fallback para phone match.
const prospects = jidMatch?.length ? jidMatch : phoneMatchResult;
```

Isso garante 3 camadas de proteção:
1. **Webhook** → move automaticamente em tempo real
2. **Sync** → move quando o usuário abre o chat (fallback)
3. **Manual** → botão já existente para casos especiais

