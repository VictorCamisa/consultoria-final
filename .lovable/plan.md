

# Auditoria: Abordagens que não chegaram ao WhatsApp

## Problema Identificado

A função `abordar-prospect` atualiza o status do prospect para `"abordado"` **independentemente** de a mensagem ter sido enviada com sucesso. Quando a Evolution API retorna erro 400 (`exists: false` — número não existe no WhatsApp), o sistema:
1. Loga o erro no console
2. Define `enviado = false`
3. **Mas ainda salva a conversa e muda o status para "abordado"**

Resultado: 3 de 7 prospects foram marcados como abordados sem que a mensagem chegasse.

### Números com falha (telefones fixos / sem WhatsApp)
- **Betty Estética**: 12 3662-1090 (fixo)
- **Bete Cabeleireira**: 12 3662-1147 (fixo)
- **Jacques Janine**: 12 9964-3568 (não existe no WhatsApp)

## Plano de Correção

### 1. Tratar erro "número não existe" na função `abordar-prospect`
- Quando Evolution retorna `exists: false`, **não marcar como abordado**
- Manter status original (`novo`) e adicionar um campo de erro visível
- Retornar resposta clara ao frontend com `reason: "numero_invalido"`

### 2. Adicionar validação prévia com `onWhatsApp` da Evolution API
- Antes de enviar, chamar o endpoint `POST /chat/whatsappNumbers/{instance}` para verificar se o número existe
- Se não existir, abortar imediatamente e notificar o usuário

### 3. Feedback visual no frontend (ProspectCard)
- Mostrar badge de alerta quando o prospect tem número inválido
- Toast específico: "Número não encontrado no WhatsApp"
- Adicionar coluna `whatsapp_valido` na tabela `consultoria_prospects` para cachear o resultado

### 4. Migração de banco
- Adicionar coluna `whatsapp_valido` (boolean, nullable) em `consultoria_prospects`
- Atualizar os 3 prospects com falha para `whatsapp_valido = false`

### Detalhes Técnicos

**`supabase/functions/abordar-prospect/index.ts`**:
- Após o bloco de envio (linhas 169-182), se `evoRes.status === 400` e a resposta contém `exists: false`:
  - Não inserir em `consultoria_conversas`
  - Não atualizar status do prospect para `abordado`
  - Marcar `whatsapp_valido = false`
  - Retornar `{ success: false, reason: "numero_invalido" }`

**`src/pages/Comercial.tsx`** / **`ProspectCard.tsx`**:
- Tratar resposta `reason: "numero_invalido"` no `handleAbordar` com toast descritivo
- Exibir ícone de alerta no card quando `whatsapp_valido === false`

