

# Auditoria CRO do Módulo de Prospecção

## Diagnóstico: Problemas Identificados

### 1. Fluxo de Conversão Quebrado (Lead → Prospect)
O módulo trata prospecção como "coleta de dados" em vez de um funil de conversão. Leads ficam parados na aba "Leads" sem nenhuma automação ou urgência para avançar ao pipeline. Não há indicadores de conversão (quantos leads viraram prospects? Em quanto tempo?).

### 2. Falta de Priorização Ativa
A lista de leads é uma tabela plana sem hierarquia visual. Leads com ICP 90 ficam visualmente iguais a leads com ICP 30. Não há "fila de ação" — quem o Danilo deve ligar primeiro? O filtro de ICP existe mas é passivo.

### 3. Desconexão com a Metodologia VS
A VS opera em 3 nichos (Estética, Odonto, Advocacia) mas o wizard oferece 12 segmentos genéricos. Isso dilui o foco e gera leads fora do ICP. Os nichos primários deveriam ter tratamento diferenciado (templates de busca otimizados, ICP scoring calibrado por nicho).

### 4. Zero Feedback Loop
Não há métricas de performance da prospecção: taxa de conversão lead→prospect, tempo médio de promoção, qual fonte gera mais conversões, qual nicho/cidade performa melhor. Sem dados, não há como otimizar.

### 5. UX Fragmentada (5 abas sem hierarquia)
O módulo tem 5 abas (Leads, Por Nicho, WhatsApp, Manual, Arquivo) tratadas como iguais. Na prática, 80% do uso é "Leads" + "Por Nicho". As abas Manual e Arquivo são utilitárias e deveriam ser secundárias.

### 6. Ação Pós-Coleta Inexistente
Depois de coletar leads, o único CTA é "enviar ao pipeline" (um botão de seta sem label visível). Não há:
- Envio em lote com 1 clique para leads de alto ICP
- Abordagem direta da tela de prospecção
- Preview do que vai acontecer ao promover

---

## Plano de Redesign (Visão CRO)

### Etapa 1 — Reestruturar a Página como Funil

Reorganizar a página em 2 zonas principais:
- **Zona Superior**: Dashboard de prospecção com 4 KPIs (leads captados na semana, taxa de conversão para pipeline, ICP médio, melhor fonte)
- **Zona Principal**: Lista de leads com priorização visual (cards maiores para ICP alto, destaque automático para leads quentes não promovidos)

Mover as abas Manual/Arquivo para um dropdown "Importar" no header. Manter "Por Nicho" e "WhatsApp" como métodos de captação acessíveis via botões de ação.

### Etapa 2 — Smart Queue (Fila Inteligente)

Adicionar uma view "Próximos a Abordar" no topo da aba Leads:
- Filtra automaticamente leads com ICP ≥ 60 que ainda não foram promovidos
- Ordena por score decrescente
- Botão "Enviar Top 10 ao Pipeline" para ação em lote
- Badge de "X leads quentes aguardando ação" como call-to-action persistente

### Etapa 3 — Nichos Primários com Destaque

No wizard de pesquisa:
- Destacar os 3 nichos VS (Estética, Odonto, Advocacia) com visual diferenciado e label "Recomendado"
- Colapsar os nichos secundários em um accordion "Outros segmentos"
- Adicionar presets de cidade por estado (top 5 cidades por estado) para reduzir fricção

### Etapa 4 — Promoção com Contexto

Redesenhar o fluxo de "Enviar ao Pipeline":
- Botão com label claro "Enviar ao Pipeline" (não apenas uma seta)
- Modal de confirmação mostrando preview do prospect que será criado
- Ação em lote com resumo: "Enviar 8 leads (ICP médio: 72) ao Pipeline"
- Auto-suggest do script de abordagem baseado no nicho

### Etapa 5 — Métricas de Performance

Adicionar ao header da página:
- Leads captados (semana/mês)
- Taxa de promoção (leads → prospects)
- ICP médio por fonte (Web vs WhatsApp vs Import)
- Busca com melhor ROI (nicho + cidade que mais converteu)

Dados extraídos das tabelas `leads_raw` e `consultoria_prospects` com query de join por origem.

---

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `src/pages/Prospeccao.tsx` | Redesign completo: layout, KPIs, smart queue, promoção em lote |
| `src/components/comercial/types.ts` | Eventual ajuste de tipos para métricas |
| Nenhuma migration necessária | Dados já existem em `leads_raw` e `consultoria_prospects` |

## O que NÃO muda
- Edge functions (scrape-leads, extract-whatsapp, search-whatsapp-groups) — funcionam bem
- Estrutura de dados — tabelas `leads_raw` e `consultoria_prospects` já suportam tudo
- Lógica de ICP scoring — bem implementada no backend

