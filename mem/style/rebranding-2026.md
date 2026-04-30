---
name: Rebranding 2026 — Brutalismo Tech (App Interno)
description: Identidade visual oficial do app interno VS após rebranding de abr/2026 — Tech Fusion dark default, Cyber Orange como ação, Poppins Black Italic + Montserrat. Convive com a memória antiga (mem://style/identidade-visual) que segue documentando o estado anterior.
type: design
---

# Rebranding 2026 — Brutalismo Tech

Aplicado APENAS ao app interno (módulos /dashboard, /comercial, /marketing, /clientes, etc.). Landing pública (vendasdesolucoes.com) também já adota a paleta dark via componentes próprios em `src/components/landing/*`.

## Paleta Tech Fusion
- Deep Space Blue `#050814` — fundo dominante (~70%)
- Cyber Orange `#FF5300` — ação primária (CTAs, números de impacto, destaque) (~10%)
- Branco Puro `#FFFFFF` — tipografia e contraste (~20%)
- Proibido outras cores dominantes (sem azuis, roxos, verdes, pasteis decorativos)

## Tipografia
- Display: **Poppins Black Italic 900** — H1, H2, números heroicos, headlines brutais
- Corpo: **Montserrat 400/500/600/700** — body, labels, UI
- Removido: Barlow Condensed e Barlow (legado pré-2026)
- Classes utilitárias: `.vs-display`, `.vs-h1`, `.vs-h2`, `.vs-h3`, `.vs-body`, `.vs-overline`, `.vs-caption`

## Tema
- **Dark é o padrão** (`<html class="dark">`), tokens HSL definidos em `:root`
- **Light alternativo** disponível via classe `.light` (toggle next-themes em `ThemeToggle`)
- Sidebar mais profundo que o background (`--sidebar-background: 228 60% 4%`)

## Tokens chave (index.css)
- `--background`, `--foreground`, `--card`, `--primary` (Cyber Orange), `--accent` (Cyber Orange)
- Surfaces semânticas: `surface-danger/warning/success/info` (versão dark e light)

## Tailwind tokens extras
- `font-display` → Poppins
- `font-sans` → Montserrat
- Cores literais: `cyber-orange` `#FF5300`, `deep-space` `#050814`

## Como aplicar
- Use sempre tokens semânticos (`bg-background`, `text-foreground`, `bg-primary`, etc.). NUNCA `bg-[#050814]` exceto em imagens de marca.
- Para títulos brutais use `font-display italic font-black tracking-tight` ou as classes `.vs-h1/.vs-h2`.
- Para números/KPIs heroicos: combine `font-display italic font-black` com `tabular`.
