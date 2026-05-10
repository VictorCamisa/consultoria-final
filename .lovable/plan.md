# Auditoria — Módulo de Prospecção

## 1. Estado atual (o que existe hoje)

### Arquitetura em produção
```
src/pages/Prospeccao.tsx (1.404 linhas)
        │ supabase.functions.invoke("scrape-leads")
        ▼
supabase/functions/scrape-leads (orquestrador + polling)
        │ fetch fire-and-forget  ── ⚠️ aqui está o bug raiz
        ▼
supabase/functions/scrape-leads-worker (Google Places + Jina + Claude)
        │ insert leads + sentinel "__job_complete__"
        ▼
public.leads_raw  ←── frontend lê via React Query
```

### Stack de scraping (atual e única)
- **Phase 1**: Google Places API (New) → texto, telefone, site, rating
- **Phase 2**: Jina Reader (`r.jina.ai`) → markdown dos sites encontrados
- **Phase 3**: Claude Haiku 4.5 → extrai email/fone faltantes
- **Phase 4**: Expansão regional (estado / interior / metropolitana)

Observação: `FIRECRAWL_API_KEY` está nos secrets mas **não é usada** no scrape-leads. `GOOGLE_API_KEY` (Maps/Places) e `GOOGLE_AI_STUDIO` (Gemini) são tratadas como intercambiáveis no código — não são.

### Dados reais no banco
| Métrica | Valor |
|--------|-------|
| Total `leads_raw` | 295 |
| `status='promoted'` | 164 |
| `status='pending'` | 128 |
| `status='job_failed'` | 3 |
| Último scrape com sucesso | **2026-04-28** (11 dias atrás) |
| Sentinels órfãs (`__job_complete__`) | 3 |
| Jobs distintos rodados (30d) | 19 |

Diagnóstico do dado: o worker **está conseguindo escrever** quando roda. Os 128 pending vêm de jobs cujos sentinels nunca foram lidos pelo polling — ou seja, o worker terminou mas o frontend mostrou "Tempo limite excedido".

---

## 2. Bugs encontrados (ordem de impacto)

### 🔴 CRÍTICO #1 — Fire-and-forget quebrado no Edge Runtime
`scrape-leads/index.ts` linha 74:
```ts
fetch(`${SUPABASE_URL}/functions/v1/scrape-leads-worker`, {...})
  .catch(e => console.error("Worker dispatch error:", e));
return json({ job_id: jobId, status: "running" }); // ← handler retorna
```
No Supabase Edge Functions (Deno Deploy), quando o handler retorna o `Response`, **a tarefa pendente é cancelada**. O worker frequentemente **nunca é invocado**. Por isso `supabase--edge_function_logs` retorna "no logs" para `scrape-leads-worker` apesar do front dizer que disparou.

Solução padrão Supabase: `EdgeRuntime.waitUntil(promise)`.

### 🔴 CRÍTICO #2 — `GOOGLE_API_KEY` vs `GOOGLE_AI_STUDIO` confusão
Worker linha 252:
```ts
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY") ?? Deno.env.get("GOOGLE_AI_STUDIO") ?? "";
```
`GOOGLE_AI_STUDIO` é chave do Gemini, não tem Places API habilitada → `googlePlacesSearch` recebe 403, retorna `[]`, worker termina com `count: 0` sem error claro. O usuário vê "0 leads" sem motivo.

### 🟡 ALTO #3 — Polling do edge function com timeout artificial
Frontend faz `invoke("scrape-leads", { poll_job_id })` 60× a cada 3s = 3min máx. Se Phase 4 (expansão) + Jina rodam em região grande, ultrapassa esse limite e o front dá "Tempo limite excedido", mas os leads JÁ ESTÃO no banco. O usuário acha que falhou.

### 🟡 ALTO #4 — Sentinel poluindo `leads_raw`
Worker insere uma linha com `name="__job_complete__"` em `leads_raw` para sinalizar fim. Quando polling expira, a sentinel fica órfã (já temos 3). Filtros e contagens precisam excluir manualmente esse "lead fake".

### 🟢 MÉDIO #5 — Sem visibilidade de progresso
Frontend mostra apenas spinner "Processando…". Não há contador "Phase X de 4", nem leads aparecendo em tempo real. Usuário não sabe se está vivo.

### 🟢 MÉDIO #6 — Sem retomada
Se o polling expira mas o worker termina depois, os leads aparecem na lista geral sem associação visual ao "job recém-rodado". Usuário precisa filtrar manualmente por nicho.

### ⚪ BAIXO #7 — Dead code
`CONSULTORIA_VS_CONTEXT` (linhas 91–95 do worker) é declarado e nunca usado.

---

## 3. Plano de correção — **sem quebrar a linha atual**

Mantém Google Places + Jina + Claude. Mantém schema `leads_raw`. Mantém UI. Só corrige a plumbing.

### Passo 1 — Background task correto (`scrape-leads`)
Substituir o `fetch fire-and-forget` por:
```ts
const workerCall = fetch(`${SUPABASE_URL}/functions/v1/scrape-leads-worker`, {...});
// @ts-ignore EdgeRuntime existe em runtime mas não no types
EdgeRuntime.waitUntil(workerCall.catch(e => console.error("Worker dispatch:", e)));
return json({ job_id: jobId, status: "running" });
```
Garante que o worker é realmente disparado.

### Passo 2 — Validar GOOGLE_API_KEY na entrada
No `scrape-leads`, antes de despachar, fazer um `fetch` mínimo a `places.googleapis.com` com a chave. Se 403, retornar erro explícito: *"GOOGLE_API_KEY não tem Places API (New) habilitada"*. Remover o fallback para `GOOGLE_AI_STUDIO` (chave errada de propósito).

### Passo 3 — Polling robusto direto no banco
Em vez de `invoke("scrape-leads", { poll_job_id })`, o frontend faz:
```ts
supabase.from("leads_raw")
  .select("*")
  .contains("tags", [`job:${jobId}`])
  .neq("name", "__job_complete__")
```
A cada 3s, com `setInterval`. Quando aparece sentinel **ou** quando passam X segundos sem novos leads, encerra. Sem timeout artificial — se o worker demorar 5 min, tudo bem.

### Passo 4 — Tabela própria para jobs (`scrape_jobs`)
Migration nova:
```sql
CREATE TABLE public.scrape_jobs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  niche text NOT NULL,
  location text,
  prospecting_intent text,
  status text NOT NULL DEFAULT 'running',  -- running|completed|failed
  count int DEFAULT 0,
  total_found int DEFAULT 0,
  pages_searched int DEFAULT 0,
  avg_icp_score int DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz
);
-- RLS: cada usuário vê seus próprios jobs
```
Worker passa a fazer UPDATE nessa tabela em vez de inserir sentinel em `leads_raw`. Frontend faz Realtime subscribe (`postgres_changes`) — substitui polling por push.

### Passo 5 — Limpeza
- Apagar as 3 sentinels órfãs (`DELETE FROM leads_raw WHERE name='__job_complete__'`).
- Remover `CONSULTORIA_VS_CONTEXT` morto.
- Remover fallback `GOOGLE_AI_STUDIO`.

### Passo 6 — Visibilidade de progresso (opcional, já desbloqueado pelo Passo 4)
Realtime subscribe em `leads_raw WHERE tags @> [job:X]`: leads aparecem na UI conforme worker insere. Card mostra `12/20 leads encontrados…` ao vivo.

---

## 4. Garantias de não-quebra

- ✅ Schema `leads_raw` permanece igual (apenas para de receber sentinels).
- ✅ `enrichment_data` continua com mesmas chaves (`icp_score`, `city`, `website`, `segment`, `job_id`).
- ✅ Promoção `leads_raw → consultoria_prospects` segue idêntica.
- ✅ `prospect_identities` / dedup batch / `is_vs_auto` intactos.
- ✅ Stack Google Places + Jina + Claude mantida.
- ✅ Os 128 leads pendentes hoje continuam acessíveis (e finalmente "destravados" para o usuário ver).

## 5. Estimativa
- Passos 1-3 + 5: **resolvem 90% do problema** (worker dispara, polling não expira, key correta). ~30 min.
- Passos 4 + 6: refinamento UX/observabilidade. ~45 min adicionais.

## 6. Decisão pra você
Posso implementar:
- **A)** Só os passos 1-3+5 (correção mínima cirúrgica, sem migration).
- **B)** Tudo (1-6), incluindo tabela `scrape_jobs` + Realtime + UI de progresso.
- **C)** Algo no meio (ex: 1-3+5 agora, e o Passo 4 num segundo PR).
