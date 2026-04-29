import { Search, FileText, Rocket, HeartHandshake } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Diagnóstico gratuito',
    description:
      '30 minutos com o time VS para entender seu negócio, volume de leads, processo atual e onde está a maior perda de receita.',
    detail: 'Chamada de 30min — sem custo',
  },
  {
    number: '02',
    icon: FileText,
    title: 'Blueprint personalizado',
    description:
      'Documento com o mapeamento completo da sua operação de vendas, os agentes de IA recomendados e a projeção de ROI para o seu caso.',
    detail: 'Entregue em até 48h',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Implantação em até 10 dias',
    description:
      'Configuração do agente, integração com seu WhatsApp, treinamento na sua linguagem e testes antes do go-live. Zero código da sua parte.',
    detail: 'Go-live em até 10 dias úteis',
  },
  {
    number: '04',
    icon: HeartHandshake,
    title: 'Acompanhamento mensal',
    description:
      'Reunião mensal de performance, ajustes no agente conforme aprendizado e relatório de resultados com métricas de conversão.',
    detail: 'Suporte contínuo incluso',
  },
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-[#0D1117] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Como Funciona
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic">
            De zero a IA vendendo em 4 passos
          </h2>
        </div>

        {/* Timeline — horizontal on lg, vertical on mobile */}
        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden lg:block absolute top-10 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-gradient-to-r from-transparent via-[#FF5300]/30 to-transparent" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map(({ number, icon: Icon, title, description, detail }, i) => (
              <div key={number} className="relative flex flex-col items-center text-center lg:items-center">
                {/* Vertical connector on mobile */}
                {i < steps.length - 1 && (
                  <div className="sm:hidden absolute top-20 left-1/2 -translate-x-1/2 w-px h-8 bg-[#FF5300]/20" />
                )}

                {/* Icon circle */}
                <div className="relative w-20 h-20 rounded-2xl bg-[#050814] border border-white/10 flex items-center justify-center mb-6 group hover:border-[#FF5300]/40 transition-colors">
                  <Icon className="w-8 h-8 text-[#FF5300]" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FF5300] flex items-center justify-center">
                    <span className="font-display font-black text-white text-xs">{i + 1}</span>
                  </span>
                </div>

                <h3 className="font-display font-bold text-white text-lg italic mb-3">{title}</h3>
                <p className="font-sans text-white/50 text-sm leading-relaxed mb-4">{description}</p>
                <span className="inline-block bg-[#FF5300]/10 border border-[#FF5300]/20 text-[#FF5300] text-xs font-sans font-semibold px-3 py-1 rounded-full">
                  {detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
