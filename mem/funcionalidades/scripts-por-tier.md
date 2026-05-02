---
name: Scripts e cadência por TIER (não por nicho)
description: Em /configuracoes, Scripts (A/B/C + system_prompt) e Cadência (D1/D3/D7/D14/D30) são organizados pelos 4 tiers da esteira VS Core OS — VS Tools, VS Departamentos, VS 360, VS Custom — não por segmento de cliente.
type: feature
---

# Scripts e Cadência: organização por TIER

A página `/configuracoes` (abas **Scripts por Tier** e **Cadência**) usa os 4 tiers da esteira VS Core OS como chave:

1. **VS Tools** — R$ 89–397, micro-tools, 7 dias. Tom direto, qualifica em 2 perguntas.
2. **VS Departamentos** — até R$ 3k/mês, 1 departamento automatizado, 21 dias. Tom consultivo.
3. **VS 360** — até R$ 12k/mês, comercial completo como serviço, 45 dias. Tom sênior, ticket alto.
4. **VS Custom** — sob consulta, projetos fora da curva. Sem preço fechado, qualifica fit antes de envolver sócio.

## Onde isso vive
- Tabela `consultoria_config`: 1 linha por tier (campo `nicho` = nome do tier).
- UI: `src/pages/Configuracoes.tsx` itera sobre `tiers` (derivado de `vs_produtos.nome` filtrado pelos 4 oficiais, com fallback hardcoded em `TIER_ORDER`).

## A aba "Nichos" é OUTRA coisa
A aba Nichos continua gerenciando **segmentos de cliente** (Estética, Odonto, Advocacia, VS AUTO) usados em prospecção, classificação automática e pipeline. Não confundir com tier.

## Métricas de ouro obrigatórias nos scripts
Resposta <1min · 98,9% assertividade · 21x menos conversão pós-30min · 80% das vendas exigem 5+ follow-ups · caso âncora Taubaté (8% → 14% conversão, R$ 187k/mês).

## Proibições
Sem emoji, sem bullets em legenda, sem jargão (jornada, mindset, alavancar, destravar, transformação).
