import { Search, FileText, Rocket, HeartHandshake } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const steps = [
  {
    icon: Search,
    title: 'Diagnóstico gratuito',
    description:
      '30 minutos com o time VS para entender seu negócio, mapear onde estão as maiores perdas — em vendas, operações ou marketing — e definir qual produto faz mais sentido para agora.',
    detail: 'Chamada de 30min · sem custo',
  },
  {
    icon: FileText,
    title: 'Blueprint personalizado',
    description:
      'Documento com o mapeamento completo da sua operação, os produtos VS recomendados para cada área e a projeção de impacto real para o seu negócio.',
    detail: 'Entregue em até 48h',
  },
  {
    icon: Rocket,
    title: 'Implantação em 10 dias',
    description:
      'Configuração das soluções, integração com seus sistemas atuais, treinamento e testes antes do go-live. Zero código da sua parte — a VS cuida de tudo.',
    detail: 'Go-live em até 10 dias úteis',
  },
  {
    icon: HeartHandshake,
    title: 'Acompanhamento contínuo',
    description:
      'Reunião mensal de performance, ajustes e evolução das automações conforme o negócio cresce. Você tem um gerente de conta dedicado e relatório de impacto mensal.',
    detail: 'Suporte contínuo incluso',
  },
];

export default function HowItWorks() {
  const { ref, visible } = useScrollReveal();

  return (
    <section id="como-funciona" className="bg-[#0D1117] py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden" ref={ref}>
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FF5300]/2 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div
          className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Como Funciona
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic">
            De diagnóstico à transformação em 4 passos
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connector — desktop */}
          <div className="hidden lg:block absolute top-10 left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px">
            <div className="w-full h-full bg-gradient-to-r from-[#FF5300]/20 via-[#FF5300]/50 to-[#FF5300]/20" />
            {/* Animated dot running along */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FF5300]"
              style={{
                animation: 'beam-sweep 4s ease-in-out infinite',
                boxShadow: '0 0 8px #FF5300',
              }}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map(({ icon: Icon, title, description, detail }, i) => (
              <div
                key={title}
                className={`relative flex flex-col items-center text-center transition-all duration-700 ${
                  visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {/* Icon circle */}
                <div className="relative w-20 h-20 rounded-2xl bg-[#050814] border border-white/8 flex items-center justify-center mb-6 group hover:border-[#FF5300]/40 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#FF5300]/10">
                  <Icon className="w-8 h-8 text-[#FF5300]" />
                  <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-[#FF5300] flex items-center justify-center shadow-md shadow-[#FF5300]/30">
                    <span className="font-display font-black text-white text-xs italic">{i + 1}</span>
                  </span>
                </div>

                <h3 className="font-display font-bold text-white text-lg italic mb-3">{title}</h3>
                <p className="font-sans text-white/45 text-sm leading-relaxed mb-4">{description}</p>
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
