

## Diagnóstico

O problema raiz: **`EdgeRuntime.waitUntil()` não existe em Supabase Edge Functions**. O fallback `?? processInBackground(...)` executa o processamento pesado de forma síncrona (3 buscas Firecrawl + chamada Claude + queries de dedup + inserts). Como tudo roda na mesma requisição, o worker estoura o limite de CPU/memória e é encerrado (os logs mostram ciclos constantes de boot → shutdown a cada ~3s).

Além disso, o registro sentinela `__job_complete__` está aparecendo na lista de leads como um card visível.

## Solução: Dividir em dois Edge Functions

Criar uma segunda Edge Function `scrape-leads-worker` que faz o trabalho pesado. A função principal `scrape-leads` dispara o worker via `fetch()` **sem `await`** (fire-and-forget) e retorna imediatamente o `job_id`.

### Mudanças

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/scrape-leads/index.ts` | Remove `processInBackground`. Dispara `fetch()` para `scrape-leads-worker` sem await. Mantém a lógica de polling. |
| `supabase/functions/scrape-leads-worker/index.ts` | **Novo**. Recebe os params via POST (autenticado com service_role_key), executa Firecrawl + AI + dedup + insert. Grava o sentinela ao final. |
| `src/pages/Prospeccao.tsx` | Filtrar leads com `name === "__job_complete__"` da listagem para não aparecerem como cards. |

### Detalhes técnicos

**scrape-leads (main)** — ao receber uma nova prospecção:
```typescript
// Fire-and-forget: chama o worker sem await
const workerUrl = `${SUPABASE_URL}/functions/v1/scrape-leads-worker`;
fetch(workerUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ niche, locationStr, desiredCount, prospecting_intent, jobId }),
});
// Retorna imediatamente
return json({ job_id: jobId, status: "running" });
```

**scrape-leads-worker** — função separada com `verify_jwt = false` (autenticada via service_role_key interno), contém toda a lógica de `processInBackground`.

**Prospeccao.tsx** — adicionar filtro `leads.filter(l => l.name !== "__job_complete__")` para esconder sentinelas.

### Otimizações adicionais de memória no worker
- Reduzir páginas de 15 para 10
- Reduzir conteúdo por página de 2000 para 1500 chars
- Usar apenas 2 queries Firecrawl em vez de 3

