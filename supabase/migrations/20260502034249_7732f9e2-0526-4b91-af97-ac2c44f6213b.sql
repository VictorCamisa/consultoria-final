
-- 1) Limpar configs antigas (organizadas por nicho de cliente)
DELETE FROM public.consultoria_config;

-- 2) Inserir 4 configs por TIER (esteira VS Core OS)
INSERT INTO public.consultoria_config (
  nicho, instancia_evolution, horario_inicio, horario_fim, ia_auto_reply,
  script_a, script_b, script_c, system_prompt,
  followup_d1, followup_d3, followup_d7, followup_d14, followup_d30,
  criterios_qualificacao
) VALUES
(
  'VS Tools', '', 9, 19, true,
  -- Script A
  'Oi {{decisor}}, vi a {{nome}} e separei uma micro-tool da VS que resolve [dor pontual] em {{cidade}}. Implantação em 7 dias, R$ 89 a R$ 397. Faz sentido eu te mandar a demo de 2 minutos?',
  -- Script B
  'Oi {{decisor}}, sou da VS. Trabalhamos com micro-ferramentas de R$ 89 a R$ 397 que rodam em até 7 dias. Olhei a {{nome}} e tem 1 gargalo que dá pra resolver hoje. Posso te mandar como funciona?',
  -- Script C
  'Oi {{decisor}}, pergunta direta: a {{nome}} responde lead em menos de 1 minuto? Se não, tenho uma tool da VS por R$ 89/mês que faz isso. Te interessa ver?',
  -- system_prompt
  'Você é o agente comercial da VS para o tier VS Tools (R$ 89 a R$ 397, micro-ferramentas, entrega em 7 dias). Tom: direto, sem enrolação, sem jargão (proibido: jornada, mindset, alavancar, destravar, transformação). Nunca usar emoji nem bullets. Foco: resolver UMA dor pontual com 1 ferramenta. Sempre citar prazo de 7 dias e faixa R$ 89 a R$ 397. Métricas oficiais da VS: resposta a lead em menos de 1 minuto, 98,9% de assertividade, caso âncora clínica em Taubaté que saiu de 8% para 14% de conversão. Qualifica em 2 perguntas: (1) qual o gargalo hoje, (2) tem orçamento até R$ 400/mês. Se sim, agenda call de 15min. Se não, oferece material e encerra educadamente.',
  -- D1
  'Oi {{decisor}}, ontem te mandei sobre a tool da VS pra {{nome}}. Conseguiu dar uma olhada?',
  -- D3
  'Oi {{decisor}}, lead respondido em mais de 30min converte 21x menos. Em 7 dias a gente coloca a {{nome}} em menos de 1 minuto por R$ 89. Vale ver?',
  -- D7
  'Oi {{decisor}}, deixo um número: 98,9% de assertividade nas respostas automáticas. Em uma clínica em Taubaté isso virou 187 mil no mês. Posso te explicar como aplicar na {{nome}}?',
  -- D14
  '{{decisor}}, sigo aqui. Se a {{nome}} ainda não tem resposta automática em menos de 1 minuto, está perdendo lead todo dia. R$ 89, 7 dias. Topa uma call de 15min?',
  -- D30
  'Encerro seu contato hoje, {{decisor}}. Se quiser retomar, me chama. Sucesso com a {{nome}}.',
  '{"orcamento_min": 89, "orcamento_max": 397, "prazo_implantacao_dias": 7, "ticket": "baixo"}'::jsonb
),
(
  'VS Departamentos', '', 9, 19, true,
  'Oi {{decisor}}, sou da VS. A gente automatiza 1 departamento inteiro da {{nome}} (comercial, atendimento ou pós-venda) por até R$ 3 mil/mês. Implantação em 21 dias. Posso te mostrar o caso de Taubaté que saiu de 8% para 14% de conversão?',
  'Oi {{decisor}}, olhei a {{nome}} em {{cidade}}. Quem responde os leads hoje? Se for humano, está perdendo dinheiro. A VS automatiza o departamento todo por até R$ 3k/mês. Topa ver o caso âncora?',
  'Oi {{decisor}}, pergunta rápida: o comercial da {{nome}} responde em menos de 1 minuto, 24h por dia? Se não, tenho um pacote da VS de R$ 3 mil que resolve. Posso explicar?',
  'Você é o agente comercial da VS para o tier VS Departamentos (até R$ 3.000/mês, automação de 1 departamento inteiro, implantação em 21 dias). Tom: consultivo, direto, sem jargão (proibido: jornada, mindset, alavancar, destravar, transformação). Nunca usar emoji nem bullets em legenda. Foco: substituir 1 departamento operacional por automação + IA gatekeeper. Métricas oficiais: resposta em menos de 1 minuto, 98,9% de assertividade, 80% das vendas exigem 5 ou mais follow-ups, lead pós-30min converte 21x menos. Caso âncora: clínica de estética em Taubaté, 2 atendentes, 180 leads/mês, 8% de conversão, virou 98% em menos de 1 minuto e 14% de conversão (R$ 187 mil/mês). Qualifica em 3 perguntas: (1) qual departamento dói mais, (2) quantas pessoas hoje, (3) faturamento mensal. Se decisor presente e ticket compatível, agenda diagnóstico de 30min.',
  'Oi {{decisor}}, ontem te falei do pacote VS Departamentos. A {{nome}} tem hoje algum gargalo claro em comercial ou atendimento?',
  'Oi {{decisor}}, dado real: 80% das vendas precisam de 5 ou mais follow-ups. A {{nome}} faz quantos? A VS automatiza isso por até R$ 3k/mês.',
  'Oi {{decisor}}, caso Taubaté: clínica saiu de R$ 0 a R$ 187 mil/mês trocando 2 atendentes por 1 departamento automatizado da VS. Quer ver o playbook aplicado na {{nome}}?',
  '{{decisor}}, último ponto antes de eu pausar: a {{nome}} sustenta um fee mensal de até R$ 3 mil pra automatizar 1 departamento? Se sim, agendo o diagnóstico.',
  'Encerro o contato por aqui, {{decisor}}. Quando quiser retomar, é só chamar.',
  '{"orcamento_max": 3000, "prazo_implantacao_dias": 21, "ticket": "medio"}'::jsonb
),
(
  'VS 360', '', 9, 19, true,
  'Oi {{decisor}}, sou da VS. A {{nome}} já tem operação comercial estruturada? A gente assume comercial + atendimento + pós-venda da empresa toda por até R$ 12 mil/mês. Caso âncora: Taubaté virou R$ 187 mil/mês. Topa um diagnóstico?',
  'Oi {{decisor}}, olhei a {{nome}}. Pra quem fatura acima de R$ 100 mil/mês, a VS opera o comercial inteiro como serviço. Até R$ 12k/mês, implantação em 45 dias. Vale uma call de 30min?',
  'Oi {{decisor}}, pergunta direta: quanto a {{nome}} fatura por mês e quanto disso depende do dono operar? Se for mais de 50%, o VS 360 resolve. Posso explicar?',
  'Você é o agente comercial da VS para o tier VS 360 (até R$ 12.000/mês, operação comercial completa como serviço, implantação em 45 dias). Tom: sênior, consultivo, calmo, sem jargão (proibido: jornada, mindset, alavancar, destravar, transformação). Nunca usar emoji nem bullets. Foco: assumir comercial + atendimento + pós-venda do cliente. Posicionamento oficial: a VS é COMERCIAL-CÊNTRICA, o comercial é operado como serviço. Métricas: resposta em menos de 1 minuto, 98,9% de assertividade, 2.500+ leads processados, 180k+ mensagens disparadas. Caso âncora: clínica em Taubaté, 2 atendentes, 8% de conversão, virou 98% em menos de 1 minuto e 14% de conversão, R$ 187 mil/mês. Qualifica: (1) faturamento mensal, (2) % do faturamento dependente do dono, (3) já tem CRM/processo, (4) decisor disponível pra diagnóstico de 30min. Só avança se ticket compatível com R$ 12k/mês.',
  'Oi {{decisor}}, ontem te mandei sobre o VS 360. A {{nome}} tem decisor disponível pra um diagnóstico de 30min esta semana?',
  'Oi {{decisor}}, número da VS: 2.500 leads processados, 180 mil mensagens, 98,9% de assertividade. Pra empresas como a {{nome}} isso vira previsibilidade. Quando agendamos?',
  'Oi {{decisor}}, no caso de Taubaté trocamos 2 atendentes por operação VS 360 e a clínica saiu de 8% para 14% de conversão (R$ 187 mil/mês). Faz sentido replicar na {{nome}}?',
  '{{decisor}}, antes de eu pausar: o teto de investimento da {{nome}} pra ter comercial operado como serviço é compatível com R$ 12 mil/mês? Se sim, agendo.',
  'Encerro por aqui, {{decisor}}. Sigo à disposição quando a {{nome}} quiser retomar.',
  '{"orcamento_max": 12000, "prazo_implantacao_dias": 45, "ticket": "alto", "faturamento_min_mes": 100000}'::jsonb
),
(
  'VS Custom', '', 9, 19, true,
  'Oi {{decisor}}, sou da VS. Para operações como a {{nome}}, montamos projetos custom (setup + fee) sob medida. Investimento sob consulta, escopo definido em diagnóstico. Topa uma conversa de 30min com sócio?',
  'Oi {{decisor}}, vi a {{nome}}. Quando o caso é fora da curva (ticket alto, operação complexa, multi-unidade), a VS desenha um projeto Custom. Posso te conectar com o sócio responsável?',
  'Oi {{decisor}}, pergunta direta: a {{nome}} tem operação multi-unidade ou estrutura comercial complexa que não cabe nos pacotes padrão? Se sim, faço a ponte com o sócio.',
  'Você é o agente comercial da VS para o tier VS Custom (alto ticket, setup + fee sob consulta, projetos sob medida). Tom: estratégico, sênior, calmo, escuta mais do que fala, sem jargão (proibido: jornada, mindset, alavancar, destravar, transformação). Nunca usar emoji nem bullets. Foco: qualificar fit antes de envolver sócio (Victor técnico ou Danilo comercial). Posicionamento: VS é COMERCIAL-CÊNTRICA, Custom é a porta para operações fora da curva. Métricas oficiais: 98,9% de assertividade, 2.500+ leads processados, 180k+ mensagens. Qualifica: (1) faturamento mensal, (2) número de unidades/operações, (3) ticket médio do cliente final, (4) urgência. Só agenda call com sócio se faturamento alto e decisor presente. Nunca cita preço fechado: investimento sob consulta.',
  'Oi {{decisor}}, ontem te falei do VS Custom. A {{nome}} tem urgência ou está em planejamento?',
  'Oi {{decisor}}, pra projetos Custom o critério é fit, não preço. Me conta em 1 linha o cenário da {{nome}} que eu avalio se faz sentido envolver sócio.',
  'Oi {{decisor}}, a VS opera 98,9% de assertividade em mais de 180 mil mensagens. Em projetos Custom esse padrão vira playbook próprio da {{nome}}. Vale conversar?',
  '{{decisor}}, último ping: se a {{nome}} tem operação fora da curva e decisor disponível, agendo direto com sócio. Confirma?',
  'Encerro o contato hoje, {{decisor}}. Quando o cenário mudar, me chama direto.',
  '{"ticket": "alto_custom", "investimento": "sob_consulta", "envolve_socio": true}'::jsonb
);

-- 3) Limpar nichos antigos e padronizar os 4 segmentos de cliente oficiais
DELETE FROM public.consultoria_nichos;

INSERT INTO public.consultoria_nichos (label, keywords, color, dot, icon, search_value, is_primary, ordem) VALUES
('Estética',  ARRAY['estética','estetic','bem-estar','cirurgia plástica'], 'bg-pink-500/15 border-pink-500/30 text-pink-400', 'bg-pink-500', '💆', 'clínicas estéticas', true, 1),
('Odonto',    ARRAY['odonto','odontológ','dentista'],                      'bg-cyan-500/15 border-cyan-500/30 text-cyan-400', 'bg-cyan-500', '🦷', 'clínicas odontológicas', true, 2),
('Advocacia', ARRAY['advoca','advocacia','advogado','direito','jurídic'], 'bg-amber-500/15 border-amber-500/30 text-amber-400','bg-amber-500','⚖️', 'escritórios de advocacia', true, 3),
('VS AUTO',   ARRAY['revenda','veículo','seminov','motors','auto','loja de carro'], 'bg-blue-500/15 border-blue-500/30 text-blue-400','bg-blue-500','🚗', 'revendas de veículos seminovos usados', true, 4);
