# Refatoração do Motor de IA Comercial — Baseada no Relatório de Pesquisa

## Contexto

O relatório detalha uma arquitetura de agentes de IA para prospecção B2B baseada em: **máquina de estados explícita**, **memória em 3 camadas**, **personas dinâmicas**, **metodologias SPIN/MEDDIC**, **orquestração multi-agente** e **Human-in-the-Loop (HITL)**. O sistema atual opera com scripts estáticos, sem estado, sem memória persistente e sem validação humana.

## Diagnóstico: Gaps Críticos


| Área         | Atual                                                                                 | Relatório recomenda                                          |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Estado       | Campo `status` simples (novo, abordado, em_cadencia)                                  | Máquina de estados com checkpointing e recuperação de falhas |
| Memória      | Histórico bruto jogado no prompt                                                      | 3 camadas: working, session, long-term                       |
| Abordagem    | Script estático A/B/C com variáveis {{nome}}                                          | Pesquisa prévia + persona dinâmica + contexto do nicho       |
| Qualificação | Score 0-100 genérico                                                                  | MEDDIC com evidências e citações diretas                     |
| Conversa     | Auto-reply cego sem validação                                                         | HITL com gatilhos de handoff + validador secundário          |
| Redundância  | Sem proteção contra "Eco da IA"                                                       | LLM validador secundário antes do envio                      |
| Provider IA  | `classify-prospect`, `suggest-reply`, `vendedor-chat` ainda chamam OpenAI diretamente | OpenAI                                                       |


---

## Plano de Implementação (6 etapas)

---

### Etapa 2 — Máquina de Estados com Checkpointing

**O quê:** Criar tabela `prospect_execution_state` que rastreia o estado exato de cada operação (pesquisa, classificação, abordagem, cadência) com checkpoints. Se uma etapa falhar, retoma do último checkpoint em vez de recomeçar do zero.

**Migration SQL:**

- Tabela `prospect_execution_state` (prospect_id, current_step, completed_steps[], context_snapshot JSONB, status, error, retry_count, created_at, updated_at)
- Enum de steps: `research → classify → draft → validate → send → await_reply → qualify → handoff`

**Impacto:** `abordar-prospect` e `process-cadencia` consultam/atualizam o estado antes de cada operação.

---

### Etapa 3 — Sistema de Personas Dinâmicas

**O quê:** Substituir scripts estáticos por personas contextuais que a IA seleciona com base no momento conversacional. Armazenar personas na tabela `consultoria_config` como JSONB.

**Personas implementadas:**

- **Gancho Imediato** — cold outreach, suprime saudações corporativas vazias
- **Reversão de Objeções** — quando detecta resistência, muda para tom diagnóstico
- **Reenquadramento de Valor** — quando detecta objeção de preço, foca em ROI
- **Diferenciação** — quando menciona concorrente, contraste sem criticar
- **Prova sobre Promessa** — decisores céticos, remove hipérboles

**Lógica:** O `suggest-reply` analisa a última mensagem do prospect, classifica a intenção (interesse, objeção, preço, concorrente, ceticismo) e injeta a persona correspondente no system prompt.

---

### Etapa 4 — Memória em 3 Camadas

**O quê:** Estruturar a injeção de contexto no prompt em 3 níveis:

1. **Working Memory** — últimas 5 mensagens (60% da janela de contexto)
2. **Session Memory** — tabela `prospect_session_memory` com fatos-chave extraídos de cada interação (decisor mencionou orçamento Q4, usa CRM X, equipe de 5 pessoas)
3. **Long-term Memory** — histórico condensado: prospect já foi abordado antes? Por quem? Resultado?

**Migration:** Tabela `prospect_session_memory` (prospect_id, fact_key, fact_value, confidence, extracted_at, source_message_id)

**Lógica:** Após cada mensagem recebida, uma função extrai fatos-chave via IA e salva. Antes de gerar resposta, os fatos são recuperados e injetados de forma estruturada no prompt.

---

### Etapa 5 — Qualificação MEDDIC Estruturada

**O quê:** Substituir o score genérico 0-100 por avaliação MEDDIC com evidências. A IA deve retornar para cada pilar: score, citação direta do prospect, nível de confiança.

**Campos MEDDIC:**

- **M**étricas — impacto quantificável mencionado
- **E**conomic Buyer — decisor identificado
- **D**ecision Criteria — critérios de escolha revelados
- **D**ecision Process — processo de compra mapeado
- **I**dentify Pain — dor explicitamente articulada
- **C**hampion — defensor interno identificado

**Migration:** Tabela `prospect_meddic` (prospect_id, pilar, score 0-100, evidencia_citacao, confianca, updated_at)

**Impacto:** `classify-prospect` passa a usar tool calling para extrair estruturadamente cada pilar MEDDIC em vez de pedir JSON livre.

---

### Etapa 6 — Validador Anti-Eco (LLM Secundário)

**O quê:** Antes de enviar qualquer mensagem automática, um segundo call de IA valida:

- Redundância com mensagens anteriores
- Tom adequado (não agressivo, não robótico)
- Coerência com o nicho
- Compliance (não fazer promessas financeiras)

**Implementação:** Nova Edge Function `validate-message` que recebe a mensagem proposta + histórico e retorna `{ approved: boolean, reason?: string, revised_message?: string }`.

**Impacto:** `whatsapp-webhook` (auto-reply) e `abordar-prospect` chamam `validate-message` antes do envio.

---

### Etapa 7 — Human-in-the-Loop com Gatilhos de Handoff

**O quê:** Implementar 3 gatilhos que pausam a automação e notificam Victor/Danilo:

1. **Gatilho Explícito** — prospect pede para falar com humano
2. **Gatilho de Repetição** — 3+ turnos sem resolução
3. **Gatilho de Alto Valor** — prospect classificado como "quente" com score MEDDIC > 70

**Lógica:** O `whatsapp-webhook` avalia gatilhos antes do auto-reply. Se ativado:

- Marca prospect como `aguardando_humano`
- Salva resumo BANT/SPIN no estado
- Envia notificação (toast no dashboard + futuro Telegram bot)
- NÃO envia auto-reply

**Migration:** Adicionar status `aguardando_humano` e campo `handoff_reason` na tabela de prospects.

---

## Ordem de Execução

1. **Etapa 1** (Estado) — fundação para as demais
2. **Etapa 2** (Memória) — melhora qualidade imediata das respostas
3. **Etapa 3** (Personas) — abordagens inteligentes
4. **Etapa 4** (MEDDIC) — qualificação profissional
5. **Etapa 5** (Validador) — segurança antes do envio
6. **Etapa 6** (HITL) — controle humano

## Arquivos Impactados

- `supabase/functions/classify-prospect/index.ts` — Gateway + MEDDIC
- `supabase/functions/suggest-reply/index.ts` — Gateway + Personas + Memória
- `supabase/functions/vendedor-chat/index.ts` — Gateway
- `supabase/functions/abordar-prospect/index.ts` — Estado + Validador
- `supabase/functions/process-cadencia/index.ts` — Estado + Validador
- `supabase/functions/whatsapp-webhook/index.ts` — HITL + Memória
- **Nova:** `supabase/functions/validate-message/index.ts`
- **Nova:** `supabase/functions/extract-facts/index.ts`
- **Migrations:** 3 novas tabelas (execution_state, session_memory, meddic)