
Objetivo: corrigir o fluxo para que o WhatsApp funcione em tempo real e de forma automática, sem depender de botão manual, e para que a conversa fique vinculada ao lead no sistema independentemente do usuário/instância usada.

1. Diagnóstico já identificado
- O problema principal não parece ser só “sincronização”, e sim inconsistência de roteamento entre funções.
- Hoje cada fluxo escolhe a instância de um jeito diferente:
  - `send-whatsapp` e `abordar-prospect` priorizam a instância do usuário autenticado.
  - `process-cadencia` usa a instância do nicho/config.
  - `sync-whatsapp-messages` tenta várias instâncias.
  - `whatsapp-webhook` só tenta casar pelo telefone.
- Isso quebra o cenário “um lead = uma conversa única no sistema”, porque o envio pode sair por uma instância e a leitura retroativa/webhook pode procurar em outra.
- Pelos dados atuais:
  - o lead Essenza existe e está em `respondeu`;
  - há instâncias abertas `Danilo-prospect` e `victorcomercial`;
  - o nicho Estética está configurado com `victorcomercial`;
  - o sync está registrando `0 mensagens encontradas`;
  - a UI grava mensagem como `saida` no banco, então o sistema aparenta ter enviado mesmo quando a entrega/espelhamento não está consistente.

2. Solução que vou implementar
- Centralizar toda a lógica de seleção de instância em um único helper compartilhado.
- Fixar o lead a uma instância/remoteJid canônicos no momento em que houver sucesso de envio ou webhook confirmado.
- Fazer o webhook virar a fonte principal de tempo real.
- Usar sincronização automática em background apenas como reconciliação/fallback, não como ação manual do usuário.
- Garantir que mensagens enviadas pelo sistema, pelo celular e recebidas do lead caiam todas no mesmo histórico do mesmo prospect.

3. Implementação proposta
- Backend / Edge Functions
  - Criar um helper compartilhado em `supabase/functions/_shared` para:
    - resolver instância principal de envio do lead;
    - listar instâncias candidatas de leitura;
    - normalizar telefone/`remoteJid`;
    - aplicar a mesma regra em todas as functions.
  - Ajustar:
    - `send-whatsapp`
    - `abordar-prospect`
    - `process-cadencia`
    - `sync-whatsapp-messages`
    - `whatsapp-webhook`
  - Nova regra de envio:
    - se o lead já tiver instância vinculada, sempre usar essa;
    - se não tiver, resolver por responsável/config e persistir a escolhida;
    - nunca depender só do usuário logado para decidir a instância do lead.
  - Nova regra de leitura:
    - webhook salva imediatamente a mensagem;
    - sync automático reconcilia mensagens faltantes sem botão.

4. Persistência necessária no banco
- Criar migração para guardar metadados de roteamento no lead e/ou nas conversas, por exemplo:
  - instância vinculada ao prospect;
  - `remote_jid` confirmado;
  - origem da mensagem (`webhook`, `system_send`, `manual_sync`, `cellphone`);
  - nome da instância em cada mensagem.
- Isso permite auditoria, evita perda de contexto e mantém a conversa no sistema mesmo se trocar o usuário operador.

5. Correções específicas do sync retroativo
- Revisar `sync-whatsapp-messages` para usar o vínculo canônico do lead primeiro, em vez de depender só de variações genéricas de número.
- Tornar o sync automático em dois momentos:
  - após envio do sistema, como reconciliação curta;
  - quando chegar webhook ou ao abrir o lead, apenas se houver lacuna detectada.
- Melhorar deduplicação usando `message_id` + fallback seguro quando o provedor não devolver ID consistente.

6. Correções específicas do tempo real
- `whatsapp-webhook` continuará salvando entrada e saída, inclusive mensagens manuais do celular.
- Ao chegar nova mensagem:
  - salvar em `consultoria_conversas`;
  - atualizar `data_ultima_interacao`;
  - invalidar/listener realtime no frontend já mostra no lead certo;
  - disparar notificação do sistema.
- O frontend deixará de depender do botão “Sincronizar” para o fluxo normal. O botão pode ficar apenas como ferramenta administrativa.

7. Ajustes na interface
- Em `ProspectWorkspace`/`ChatSheet`:
  - remover a dependência funcional do sync manual;
  - exibir o status real da conversa/instância;
  - opcionalmente mostrar a origem da mensagem (celular, sistema, automação).
- Em notificações:
  - manter alerta em tempo real quando responderem um lead enquanto o usuário estiver em outra tarefa.

8. Validação que vou fazer depois da implementação
- Teste 1: enviar mensagem pelo sistema e confirmar que aparece no WhatsApp real.
- Teste 2: responder pelo celular e confirmar que aparece automaticamente no lead sem clicar em nada.
- Teste 3: enviar pelo celular e pelo sistema em sequência e confirmar histórico único, sem duplicação.
- Teste 4: trocar de usuário logado e confirmar que o mesmo lead continua mostrando a mesma conversa.
- Teste 5: validar retroativo para o lead Essenza e outros leads já existentes.

9. Arquivos previstos
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/abordar-prospect/index.ts`
- `supabase/functions/process-cadencia/index.ts`
- `supabase/functions/sync-whatsapp-messages/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- novo helper em `supabase/functions/_shared/...`
- `src/components/comercial/ProspectWorkspace.tsx`
- `src/components/comercial/ChatSheet.tsx`
- possivelmente `src/components/WhatsAppNotificationListener.tsx`
- migração em `supabase/migrations/...`

10. Resumo técnico
- Causa mais provável: conflito entre instância do usuário, instância do nicho e instância real do lead.
- Efeito: o sistema grava localmente, mas envio/leitura podem estar falando com instâncias diferentes.
- Correção estrutural: vínculo persistente lead ↔ instância/remoteJid + webhook como verdade principal + sync automático de reconciliação.
