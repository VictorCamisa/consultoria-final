import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Quanto custa a VS Soluções?',
    answer:
      'Os planos começam a partir de R$800/mês para o VS Sales (agente de IA para vendas no WhatsApp). O VS 360, nosso plano completo, vai de R$6.000 a R$12.000/mês dependendo do escopo. Fazemos um diagnóstico gratuito antes de qualquer proposta para garantir que o investimento faça sentido para o seu momento.',
  },
  {
    question: 'Quanto tempo demora para implantar?',
    answer:
      'Nossa implantação padrão leva até 10 dias úteis a partir da assinatura do contrato. Isso inclui configuração do agente, treinamento na linguagem do seu negócio, integração com seu WhatsApp e testes antes do go-live. Projetos maiores (VS 360) podem levar até 21 dias.',
  },
  {
    question: 'Preciso ter equipe técnica ou saber de TI?',
    answer:
      'Não. A VS cuida de toda a parte técnica. Você só precisa ter um número de WhatsApp Business e nos passar acesso. Nossa equipe configura tudo — agente, integrações, automações — sem exigir nenhum conhecimento técnico da sua parte.',
  },
  {
    question: 'Funciona para o meu nicho de mercado?',
    answer:
      'Já atendemos estética, odontologia, advocacia, revendas de veículos, educação e outros segmentos. A IA é treinada com o contexto, linguagem e objeções específicas do seu mercado. Se o seu nicho for diferente, fazemos uma avaliação de viabilidade no diagnóstico gratuito.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. Nossos contratos são mensais, sem fidelidade. Pedimos apenas 30 dias de aviso prévio para encerramento. Não acreditamos em reter cliente com multa — queremos que você continue porque os resultados justificam.',
  },
  {
    question: 'Como é o suporte? Tenho algum contato direto?',
    answer:
      'Cada cliente tem um gerente de conta dedicado acessível via WhatsApp em horário comercial. Realizamos reuniões mensais de performance para revisar métricas e ajustar a estratégia. Ajustes urgentes no agente são atendidos em até 24h úteis.',
  },
  {
    question: 'O agente de IA substitui meu vendedor?',
    answer:
      'Não necessariamente. O agente funciona como primeiro atendimento: responde instantaneamente, qualifica o lead e, quando o timing é ideal, faz handoff para o vendedor humano fechar. A IA elimina o trabalho repetitivo e garante que nenhum lead fique sem resposta, liberando seu vendedor para fechar negócios.',
  },
  {
    question: 'Meus clientes vão saber que é uma IA?',
    answer:
      'O agente tem personalidade e nome próprios (ex: "Ana da Clínica X") e se comporta de forma natural. A maioria dos leads não percebe que é IA até você querer revelar. Trabalhamos com transparência total — se quiser deixar claro que é assistente virtual, configuramos isso também.',
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
