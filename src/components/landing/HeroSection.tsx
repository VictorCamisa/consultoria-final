import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface HeroSectionProps {
  whatsappNumber: string;
}

function WhatsAppMockup() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Phone frame */}
      <div className="bg-[#0D1117] border border-white/10 rounded-3xl p-1 shadow-xl">
        {/* Status bar */}
        <div className="bg-[#128C7E] rounded-t-3xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-xs font-bold">VS</span>
          </div>
          <div>
            <p className="text-white text-xs font-semibold">VS Sales — IA</p>
            <p className="text-green-300 text-xs">online agora</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>

        {/* Chat body */}
        <div className="bg-[#0A1014] px-3 py-4 space-y-3 rounded-b-3xl min-h-[280px]">
          {/* Incoming message */}
          <div className="flex justify-start">
            <div className="bg-[#1F2C34] rounded-2xl rounded-tl-none px-3 py-2 max-w-[80%]">
              <p className="text-white/90 text-xs">Olá! Vi o seu anúncio. Quanto custa o plano?</p>
              <p className="text-white/40 text-[10px] text-right mt-1">14:23</p>
            </div>
          </div>

          {/* Outgoing AI message */}
          <div className="flex justify-end">
            <div className="bg-[#005C4B] rounded-2xl rounded-tr-none px-3 py-2 max-w-[80%]">
              <p className="text-white/90 text-xs">
                Oi! Sou a Ana da VS Soluções 👋 Temos planos a partir de R$800/mês.
                Me conta: quantos leads você recebe por mês?
              </p>
              <p className="text-white/40 text-[10px] text-right mt-1">14:23 ✓✓</p>
            </div>
          </div>

          {/* Incoming */}
          <div className="flex justify-start">
            <div className="bg-[#1F2C34] rounded-2xl rounded-tl-none px-3 py-2 max-w-[80%]">
              <p className="text-white/90 text-xs">Umas 80 por mês, mas perco muitos...</p>
              <p className="text-white/40 text-[10px] text-right mt-1">14:25</p>
            </div>
          </div>

          {/* Outgoing AI — with typing indicator */}
          <div className="flex justify-end">
            <div className="bg-[#005C4B] rounded-2xl rounded-tr-none px-3 py-2 max-w-[80%]">
              <p className="text-white/90 text-xs">
                Com 80 leads e 40% de perda, você está deixando ~R$32k na mesa todo mês.
                Quer ver como resolver isso agora? 🚀
              </p>
              <p className="text-white/40 text-[10px] text-right mt-1">14:25 ✓✓</p>
            </div>
          </div>

          {/* Typing */}
          <div className="flex justify-start">
            <div className="bg-[#1F2C34] rounded-2xl rounded-tl-none px-3 py-2">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#FF5300]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-6 -left-6 w-32 h-32 bg-[#FF5300]/10 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}

export default function HeroSection({ whatsappNumber }: HeroSectionProps) {
  const waLink = `https://wa.me/${whatsappNumber}?text=Quero%20ver%20uma%20demo%20da%20VS%20Solu%C3%A7%C3%B5es!`;

  return (
    <section
      id="hero"
      className="relative min-h-screen bg-[#050814] flex items-center overflow-hidden pt-16"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#FF5300 1px, transparent 1px), linear-gradient(90deg, #FF5300 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div className="animate-slide-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[#FF5300]/10 border border-[#FF5300]/30 rounded-full px-3 py-1 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5300] animate-pulse" />
              <span className="text-[#FF5300] text-xs font-sans font-semibold uppercase tracking-widest">
                IA para vendas via WhatsApp
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight italic mb-6">
              Sua empresa vende pelo WhatsApp.{' '}
              <span className="text-[#FF5300]">A VS faz isso acontecer 24/7.</span>
            </h1>

            {/* Subheadline */}
            <p className="font-sans text-white/60 text-lg leading-relaxed mb-8 max-w-lg">
              Agentes de IA que abordam, qualificam e convertem leads no WhatsApp — sem vendedor,
              sem demora, sem lead desperdiçado. Resultado mensurável em até 10 dias.
            </p>

            {/* Bullets */}
            <ul className="space-y-3 mb-10">
              {[
                '98,9% de assertividade nas respostas',
                '+16% de conversão vs. vendedor humano',
                'Implantação em até 10 dias úteis',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-white/80 text-sm font-sans">
                  <CheckCircle2 className="w-4 h-4 text-[#FF5300] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold px-6 py-3.5 rounded-md transition-colors"
              >
                Quero ver uma demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#roi"
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white font-sans font-medium px-6 py-3.5 rounded-md transition-colors"
              >
                Calcular meu ROI
              </a>
            </div>
          </div>

          {/* Right — mockup */}
          <div className="animate-fade-in">
            <WhatsAppMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
