import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Quais são os produtos da VS Soluções?',
    answer:
      'Temos quatro produtos principais: VS Sales (agente IA para atendimento e vendas via WhatsApp), VS Marketing (conteúdo estratégico, tráfego pago e automação de campanhas), VS Departamentos (IA para processos internos: RH, financeiro, atendimento, operações) e VS 360 (transformação completa com todos os produtos integrados e acompanhamento semanal). Também oferecemos o Diagnóstico Estratégico e o Acompanhamento Mensal como serviços avulsos.',
  },
  {
    question: 'Quanto custa cada produto?',
    answer:
      'Os valores variam conforme o escopo: VS Sales a partir de R$800/mês, VS Marketing a partir de R$1.200/mês, VS Departamentos entre R$800 e R$3.000/mês, e o VS 360 (stack completo) de R$6.000 a R$12.000/mês. Realizamos um diagnóstico gratuito antes de qualquer proposta para garantir que o produto certo faça sentido para o seu momento.',
  },
  {
    question: 'Quanto tempo demora para implantar?',
    answer:
      'A implantação padrão leva até 10 dias úteis. Isso inclui configuração das soluções, integração com seus sistemas atuais, treinamento e testes antes do go-live. Projetos maiores como o VS 360 podem levar até 21 dias. A VS cuida de toda a parte técnica — você não precisa de equipe de TI.',
  },
  {
    question: 'Preciso contratar todos os produtos de uma vez?',
    answer:
      'Não. Você pode começar com o produto que resolve a dor mais urgente (ex: VS Sales para atendimento ou VS Departamentos para processos) e evoluir para outros conforme o negócio cresce. O Diagnóstico Estratégico gratuito ajuda a definir o melhor ponto de entrada.',
  },
  {
    question: 'Funciona para o meu nicho de mercado?',
    answer:
      'Já atendemos estética, odontologia, advocacia, revendas de veículos, educação, clínicas de saúde e outros segmentos. Todos os produtos são configurados com o contexto, linguagem e processos específicos do seu mercado. Se o seu nicho for diferente, avaliamos a viabilidade no diagnóstico gratuito.',
  },
  {
    question: 'O VS Departamentos substitui meu software de gestão atual?',
    answer:
      'Não necessariamente. O VS Departamentos geralmente se integra com os sistemas que você já usa (WhatsApp, e-mail, planilhas, ERPs), automatizando tarefas repetitivas sem exigir que você troque de plataforma. Em alguns casos sugerimos substituições pontuais, mas sempre após análise.',
  },
  {
    question: 'O agente de IA (VS Sales) substitui meu vendedor?',
    answer:
      'Não necessariamente. O agente funciona como primeiro atendimento: responde instantaneamente, qualifica o lead e, quando o timing é ideal, faz handoff para o vendedor humano fechar. A IA elimina o trabalho repetitivo e garante que nenhum lead fique sem resposta, liberando seu time para o que realmente importa.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. Nossos contratos são mensais, sem fidelidade. Pedimos apenas 30 dias de aviso prévio para encerramento. Não acreditamos em reter cliente com multa — queremos que você continue porque os resultados justificam.',
  },
  {
    question: 'Como é o suporte após a implantação?',
    answer:
      'Cada cliente tem um gerente de conta dedicado acessível via WhatsApp em horário comercial. Realizamos reuniões mensais de performance para revisar métricas e ajustar as soluções. Ajustes urgentes são atendidos em até 24h úteis.',
  },
];

export default function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#0D1117] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Dúvidas Frequentes
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic">
            Respondendo antes de você perguntar
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`bg-[#050814] border rounded-xl overflow-hidden transition-colors ${
                  isOpen ? 'border-[#FF5300]/30' : 'border-white/10'
                }`}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span className="font-sans font-semibold text-white text-sm leading-snug">
                    {faq.question}
                  </span>
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isOpen ? 'bg-[#FF5300]' : 'bg-white/10'
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="w-3 h-3 text-white" />
                    ) : (
                      <Plus className="w-3 h-3 text-white/60" />
                    )}
                  </span>
                </button>

                <div
                  className={`transition-all duration-200 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  } overflow-hidden`}
                >
                  <p className="font-sans text-white/50 text-sm leading-relaxed px-6 pb-5">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
