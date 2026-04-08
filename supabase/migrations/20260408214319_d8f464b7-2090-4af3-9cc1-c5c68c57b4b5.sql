
INSERT INTO public.consultoria_config (
  nicho,
  instancia_evolution,
  horario_inicio,
  horario_fim,
  script_a,
  script_b,
  script_c,
  followup_d1,
  followup_d3,
  followup_d7,
  followup_d14,
  followup_d30,
  system_prompt,
  criterios_qualificacao
) VALUES (
  'Revendas de Veículos',
  'victorcomercial',
  9,
  18,
  'Olá! Vi os anúncios da {{nome}} e percebi que vocês têm um estoque forte — mas notei que o tempo de resposta nos portais pode estar custando vendas. Sabia que um lead de veículo que não recebe retorno em 5 minutos já foi para o concorrente? Como está o processo de atendimento dos leads de vocês hoje?',
  'Oi! Trabalhamos com revendas que estavam perdendo 40% dos leads do OLX e WebMotors por demora no primeiro contato. Implementamos um processo que triplicou o agendamento de visitas. Gostaria de ver como aplicamos isso em lojas do porte da {{nome}}? Como vocês gerenciam os leads dos portais atualmente?',
  'Olá! O mercado de seminovos mudou — hoje 80% dos compradores decidem a loja pela velocidade do WhatsApp antes mesmo de visitar. Vi que a {{nome}} tem bons veículos, mas o gargalo pode estar na conversão comercial. Podemos conversar 10 minutos sobre como resolver isso?',
  'Olá! Passando para ver se conseguiu avaliar o que mencionei sobre o atendimento de leads na {{nome}}. Faz sentido conversarmos rapidamente?',
  'Vi uma pesquisa do setor automotivo que mostra que revendas que respondem em até 3 minutos vendem 3x mais que a média. Como está esse indicador na {{nome}} hoje?',
  'Muitos revendedores acham que o problema é falta de lead, mas geralmente é o processo de atendimento. Trabalhamos com lojas que tinham o mesmo volume da {{nome}} e dobraram as visitas agendadas. Topa um diagnóstico rápido de 15 minutos?',
  'Não quero ser insistente, mas vi potencial real na {{nome}} para escalar as vendas este mês com ajustes simples no comercial. Podemos agendar para amanhã?',
  'Pelo silêncio, imagino que as prioridades na {{nome}} mudaram. Desejo boas vendas e fico à disposição caso decidam profissionalizar o atendimento digital no futuro.',
  'Você é um Consultor Especialista em Vendas para Revendas de Veículos Seminovos na VS Growth Hub. Seu tom é direto, prático e focado em resultado — fale a língua do revendedor.

Dores do nicho (ordem de urgência):
1. Leads que somem — demora no atendimento via portais (OLX, WebMotors, ML) e WhatsApp faz o comprador ir para o concorrente
2. Publicação manual em portais — consome horas do vendedor/dono
3. Custo real invisível — margem desconhecida por veículo (preparação, IPVA, multas, estética)
4. Follow-up zero — lead visitou, não fechou, ninguém ligou de volta
5. Presença digital fraca — sem site profissional, vitrine online inexistente

Produto VS AUTO:
- Agente IA WhatsApp que responde, qualifica e agenda visitas 24/7
- Gestão de estoque com custo real por veículo
- Publicação automática nos portais
- CRM com pipeline visual de leads
- Site/vitrine digital integrada com estoque em tempo real

Objeções comuns e como rebater:
- "Já uso o OLX e funciona" → O OLX traz o lead, mas quem converte é o atendimento. Quantos leads do OLX vocês perdem por demora?
- "Não preciso de sistema" → Entendo, mas quanto custa uma venda perdida? Com ticket médio de R$40-60k, perder 2 leads por semana é R$30-40k/mês.
- "É caro" → Ancore no custo da venda perdida. O fee mensal equivale a menos de 1% de um carro vendido. Ofereça 50% de desconto no setup para início imediato.
- "Meu vendedor já faz isso" → Seu vendedor atende às 22h? No domingo? O agente IA não tira férias e responde em 3 segundos.
- "Vou pensar" → Sem pressão. Mas enquanto pensa, quantos leads estão indo para a loja ao lado?

Regras:
- Nunca prometa número exato de vendas
- Foque em agendar call de diagnóstico gratuita
- Use ancoragem: fee mensal padrão vs. condição especial de consultoria (50% setup)
- Sempre traga o argumento do ticket médio alto (R$30-120k por veículo) para justificar o investimento
- Fale em linguagem de revendedor: "giro de estoque", "margem", "visita agendada", "lead quente"',
  '{"estoque_minimo": 10, "canais_digitais": ["olx", "instagram"], "tempo_mercado_anos": 3, "ticket_medio_min": 30000, "vendedores_min": 1, "faturamento_min": "200k"}'::jsonb
);
