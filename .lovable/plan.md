

# Correção: Ativar Claude na Prospecção

## Situação Atual
- O código já usa `callClaude` em 3 Edge Functions: `scrape-leads`, `classify-prospect`, `suggest-reply`
- **Falta o secret `ANTHROPIC_API_KEY`** no Supabase — a função falha imediatamente
- **Modelo errado**: `claude-haiku-4-5-20251001` não existe. O correto é `claude-3-5-haiku-20241022`

## Plano (2 passos)

### 1. Adicionar secret `ANTHROPIC_API_KEY`
- Usar a ferramenta de secrets para solicitar sua chave da Anthropic

### 2. Corrigir modelo no `ai-client.ts`
- Linha 32: trocar `"claude-haiku-4-5-20251001"` → `"claude-3-5-haiku-20241022"`
- Redeployar as 3 Edge Functions que usam o helper: `scrape-leads`, `classify-prospect`, `suggest-reply`

### Resultado
Com essas 2 correções, o módulo de prospecção passará a usar Claude Haiku corretamente para extração de leads e classificação MEDDIC.

