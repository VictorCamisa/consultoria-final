import { Bot, Megaphone, Building2, Globe, ArrowRight } from 'lucide-react';

const WS_NUMBER = '5512999999999';

interface Product {
  icon: React.ElementType;
  name: string;
  tagline: string;
  description: string;
  price: string;
  highlight: boolean;
}

const products: Product[] = [
  {
    icon: Bot,
    name: 'VS Sales',
    tagline: 'Agente de IA para vendas',
    description:
      'Agente IA que aborda, qualifica e converte leads no WhatsApp 24/7, com personalidade, MEDDIC scoring e handoff inteligente.',
    price: 'A partir de R$800/mês',
    highlight: false,
  },
  {
    icon: Megaphone,
    name: 'VS Marketing',
    tagline: 'Conteúdo + tráfego',
    description:
      'Criação de conteúdo estratégico, gestão de tráfego pago e automação de campanhas integrada ao seu funil de vendas.',
    price: 'A partir de R$1.200/mês',
    highlight: false,
  },
  {
    icon: Building2,
    name: 'VS Departamentos',
    tagline: 'IA nos departamentos',
    description:
      'Automação de processos internos com IA: atendimento, RH, financeiro e operações — sem precisar de equipe técnica própria.',
    price: 'R$800 – R$3.000/mês',
    highlight: false,
  },
  {
    icon: Globe,
    name: 'VS 360',
    tagline: 'Transformação completa',
    description:
      'Stack completo: Sales + Marketing + Departamentos + estratégia de crescimento com acompanhamento semanal do time VS.',
    price: 'R$6.000 – R$12.000/mês',
    highlight: true,
  },
];

export default function ProductsGrid() {
  return (
    <section id="solucao" className="bg-[#050814] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Nossos Produtos
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic mb-4">
            Uma solução para cada etapa do seu crescimento
          </h2>
          <p className="font-sans text-white/50 text-base max-w-xl mx-auto">
            Do primeiro agente de IA até a transformação completa da empresa — a VS tem o produto certo para onde você está agora.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {products.map(({ icon: Icon, name, tagline, description, price, highlight }) => (
            <div
              key={name}
              className={`relative rounded-xl p-8 border transition-all group ${
                highlight
                  ? 'bg-[#FF5300]/10 border-[#FF5300]/40 hover:border-[#FF5300]'
                  : 'bg-[#0D1117] border-white/10 hover:border-white/30'
              }`}
            >
              {highlight && (
                <div className="absolute top-4 right-4">
                  <span className="bg-[#FF5300] text-white text-xs font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Mais Completo
                  </span>
                </div>
              )}

              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 ${
                  highlight ? 'bg-[#FF5300]/20' : 'bg-white/5'
                }`}
              >
                <Icon className={`w-6 h-6 ${highlight ? 'text-[#FF5300]' : 'text-white/70'}`} />
              </div>

              <p
                className={`font-sans text-xs font-semibold uppercase tracking-widest mb-1 ${
                  highlight ? 'text-[#FF5300]' : 'text-white/40'
                }`}
              >
                {tagline}
              </p>
              <h3 className="font-display font-black text-2xl text-white italic mb-3">{name}</h3>
              <p className="font-sans text-white/50 text-sm leading-relaxed mb-6">{description}</p>

              <div className="flex items-center justify-between">
                <span className="font-sans text-white/80 text-sm font-semibold">{price}</span>
                <a
                  href={`https://wa.me/${WS_NUMBER}?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20${encodeURIComponent(name)}!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-sm font-sans font-semibold transition-colors ${
                    highlight
                      ? 'text-[#FF5300] hover:text-orange-400'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Falar com especialista
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
