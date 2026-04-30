---
name: Módulos do VS Core OS
description: Mapa dos módulos do sistema interno conforme Blueprint Core OS — Comercial, Gatekeeper, Onboarding, Telemetria/Health Score, Financeiro/Billing, Governança. Inclui status de maturidade.
type: feature
---

# Módulos do VS Core OS

| Módulo | Função | Status |
|---|---|---|
| **Comercial** | Pipeline, prospecção, scripts, cadência. Coração do sistema. | Maduro |
| **Gatekeeper (IA)** | Qualifica e responde lead em <1min via WhatsApp. 98,9% assertividade. | Maduro |
| **Onboarding** | Imersão (22 campos, mín. 17), diagnóstico (32 perguntas, 4 dimensões), devolutiva. | Maduro |
| **Telemetria / Health Score** | Métricas por cliente, alertas de churn, ROI em tempo real. | Em desenvolvimento |
| **Financeiro / Billing dinâmico** | Cobrança por tier, upgrade/downgrade automático. | Pendente |
| **Governança** | Permissões Victor (técnico) × Danilo (comercial), auditoria. | Parcial |

## Regra de arquitetura
Qualquer feature nova deve ser encaixada em um destes 6 módulos. Não criar módulo novo sem aprovação explícita.