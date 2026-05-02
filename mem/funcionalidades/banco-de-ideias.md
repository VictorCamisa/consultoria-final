---
name: Banco de Ideias
description: Módulo /ideias — repositório central de ideias (produto, comercial, marketing, processo, tech) com Kanban de 6 status, scoring impacto/esforço e vínculo com módulos do Core OS.
type: feature
---

# Banco de Ideias (/ideias)

Repositório central onde Victor e Danilo capturam ideias do dia a dia, priorizam e movem até a entrega.

## Estrutura
- Tabela `vs_ideias` (RLS authenticated)
- Página `/ideias` com Kanban de 6 colunas

## Status (Kanban)
captura → análise → priorizada → em_execucao → entregue → arquivada

## Campos
- titulo, descricao, categoria (produto/comercial/marketing/processo/tech)
- modulo (vincula a um dos 6 módulos do Core OS)
- autor (victor/danilo/outro)
- impacto 1-5, esforco 1-5
- score = impacto/esforco (gerado pelo banco, ordenação default desc)
- tags[], link_origem, observacoes

## Onde fica no menu
Sidebar > Governança > Banco de Ideias (ícone Lightbulb)
