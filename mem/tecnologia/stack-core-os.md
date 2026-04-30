---
name: Stack Técnico Core OS
description: Stack oficial do app interno conforme Blueprint — Lovable/React/Tailwind dark, Poppins+Montserrat+JetBrains Mono, Claude Haiku 4.5 (cliente) e Sonnet (interno).
type: feature
---

# Stack Core OS

## Frontend
- Lovable + React 18 + TypeScript + Tailwind v3
- Tema **Dark default** — Deep Space Blue `#050814` + Cyber Orange `#FF5300`
- Tipografia: **Poppins Black Italic** (display), **Montserrat** (body), **JetBrains Mono** (números/dados)
- Desktop-only (1280px+)

## Backend
- Supabase (Auth, DB, Edge Functions, Storage)
- Evolution API para WhatsApp (internalizada em Configurações)

## Modelos de IA
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — uso voltado ao cliente (gatekeeper, qualificação, atendimento)
- **Claude Sonnet** — tarefas internas pesadas (scoring profundo, análises, coaching)
- **Lovable AI Gateway** (Gemini 2.5 Pro / Flash) — geração de conteúdo (posts, copy)
- Fallback regex para JSON quando IA não retorna estruturado

## Dados
- Numerais sempre em JetBrains Mono tabular
- KPIs com `font-display italic font-black`