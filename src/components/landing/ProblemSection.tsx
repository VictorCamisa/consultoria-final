import { Clock, TrendingDown, BarChart2 } from 'lucide-react';

const problems = [
  {
    icon: Clock,
    number: '73%',
    title: 'Lead chega, vendedor demora — concorrente fecha.',
    description:
      'Pesquisas mostram que 73% dos leads compram do primeiro fornecedor que responde. Cada minuto de demora é receita indo embora.',
  },
  {
    icon: TrendingDown,
    number: '5×',
    title: 'Equipe não aguenta o volume e a qualidade cai.',
    description:
      'Vendedores esgotados cometem erros, perdem o timing certo e deixam leads quentes esfriar. Escalar time humano custa 5x mais.',
  },
  {
    icon: BarChart2,
    number: '0',
    title: 'Sem dados, sem previsibilidade — só feeling.',
    description:
      'Sem rastreamento de cada interação, não há como saber onde os leads somem, qual script converte e onde o funil vaza.',
  },
];

export default function ProblemSection() {
  return (
    <section className="bg-[#0D1117] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            O Problema
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic">
            Por que você está perdendo leads agora mesmo
          </h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {problems.map(({ icon: Icon, number, title, description }) => (
            <div
              key={title}
              className="bg-[#050814] border border-white/10 rounded-xl p-8 hover:border-[#FF5300]/30 transition-colors group"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-[#FF5300]/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#FF5300]/20 transition-colors">
                  <Icon className="w-6 h-6 text-[#FF5300]" />
                </div>
                <span className="font-display font-black text-5xl text-[#FF5300] italic leading-none">
                  {number}
                </span>
              </div>
              <h3 className="font-display font-bold text-white text-lg italic mb-3 leading-tight">
                {title}
              </h3>
              <p className="font-sans text-white/50 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
