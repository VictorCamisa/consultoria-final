import { Bot, Megaphone, Building2, Globe, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { openVSChat } from './VSChatAgent';

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
  const { ref, visible } = useScrollReveal();

  return (
    <section id="solucao" className="bg-[#050814] py-24 px-4 sm:px-6 lg:px-8 relative" ref={ref}>
      {/* Top edge glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-[#FF5300]/30 to-transparent" />

      <div className="max-w-7xl mx-auto">
        <div
          className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Nossos Produtos
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic mb-4">
            Uma solução para cada etapa do seu crescimento
          </h2>
          <p className="font-sans text-white/45 text-base max-w-xl mx-auto">
            Do primeiro agente de IA até a transformação completa da empresa — a VS tem o produto certo para onde você está agora.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {products.map(({ icon: Icon, name, tagline, description, price, highlight }, i) => (
            <div
              key={name}
              className={`relative rounded-xl p-8 border transition-all duration-500 group hover:-translate-y-1 ${
                highlight
                  ? 'bg-[#FF5300]/8 border-[#FF5300]/30 hover:border-[#FF5300] hover:shadow-lg hover:shadow-[#FF5300]/10'
                  : 'bg-[#0D1117] border-white/8 hover:border-white/20'
              } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {highlight && (
                <div className="absolute top-4 right-4">
                  <span className="bg-[#FF5300] text-white text-xs font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Mais Completo
                  </span>
                </div>
              )}

              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-5 transition-colors ${
                  highlight ? 'bg-[#FF5300]/20 group-hover:bg-[#FF5300]/30' : 'bg-white/5 group-hover:bg-white/8'
                }`}
              >
                <Icon className={`w-6 h-6 ${highlight ? 'text-[#FF5300]' : 'text-white/60'}`} />
              </div>

              <p
                className={`font-sans text-xs font-semibold uppercase tracking-widest mb-1 ${
                  highlight ? 'text-[#FF5300]' : 'text-white/35'
                }`}
              >
                {tagline}
              </p>
              <h3 className="font-display font-black text-2xl text-white italic mb-3">{name}</h3>
              <p className="font-sans text-white/45 text-sm leading-relaxed mb-6">{description}</p>

              <div className="flex items-center justify-between">
                <span className="font-sans text-white/75 text-sm font-semibold">{price}</span>
                <button
                  onClick={() => openVSChat(name)}
                  className={`inline-flex items-center gap-1.5 text-sm font-sans font-semibold transition-colors ${
                    highlight
                      ? 'text-[#FF5300] hover:text-orange-400'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  Falar com especialista
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
