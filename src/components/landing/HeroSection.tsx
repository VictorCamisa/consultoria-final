import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import VSLogo from './VSLogo';
import { openVSChat } from './VSChatAgent';


/* ── Particles ── */
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${Math.round(((i * 37 + 11) % 97))}%`,
  top: `${Math.round(((i * 53 + 7) % 90))}%`,
  size: [3, 4, 2, 3, 4, 2, 3][i % 7],
  delay: `${(i * 0.41) % 3}s`,
  duration: `${3 + (i % 3)}s`,
  opacity: [0.15, 0.25, 0.1, 0.2, 0.3][i % 5],
}));

/* ── Animated WhatsApp Mockup ── */
const messages = [
  { from: 'in',  text: 'Oi! Como a VS pode ajudar minha clínica?', delay: 0 },
  { from: 'out', text: 'Olá! Sou a Ana da VS 👋 Atuamos em vendas, marketing e operações com IA. Por onde quer começar?', delay: 1400 },
  { from: 'in',  text: 'Perco muitos leads e meu time está sobrecarregado...', delay: 2800 },
  { from: 'out', text: 'Entendi! Temos soluções pra isso: VS Sales (atendimento 24/7) + VS Departamentos (automatiza processos internos). Posso te explicar? 🚀', delay: 4200 },
];

function ChatMockup() {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const timers = messages.map((m, i) =>
      setTimeout(() => setVisible((prev) => [...prev, i]), m.delay + 600)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative w-full max-w-[340px] mx-auto animate-float">
      {/* Glow behind phone */}
      <div className="absolute inset-0 -m-8 bg-[#FF5300]/10 rounded-full blur-3xl animate-glow" />

      {/* Phone shell */}
      <div className="relative bg-[#0D1117] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl shadow-black/60">
        {/* Status bar */}
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-black font-display italic">VS</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold leading-none">VS Soluções — Ana IA</p>
            <p className="text-green-300 text-[10px] mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              online agora
            </p>
          </div>
        </div>

        {/* Chat body */}
        <div
          className="px-3 py-4 space-y-3 min-h-[260px]"
          style={{ background: 'linear-gradient(180deg, #0A1014 0%, #0D1117 100%)' }}
        >
          {messages.map((msg, i) =>
            visible.includes(i) ? (
              <div
                key={i}
                className={`flex ${msg.from === 'out' ? 'justify-end' : 'justify-start'} animate-reveal-up`}
                style={{ animationDelay: '0ms' }}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                    msg.from === 'out'
                      ? 'rounded-tr-none bg-[#005C4B]'
                      : 'rounded-tl-none bg-[#1F2C34]'
                  }`}
                >
                  <p className="text-white/90 text-[11px] leading-relaxed">{msg.text}</p>
                  <p className="text-white/35 text-[9px] text-right mt-1">
                    {msg.from === 'out' ? '✓✓' : ''}{' '}
                    {`1${Math.floor(i / 2) + 4}:2${i}`}
                  </p>
                </div>
              </div>
            ) : null
          )}

          {/* Typing indicator after last message */}
          {visible.length === messages.length && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-[#1F2C34] rounded-2xl rounded-tl-none px-3 py-2">
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#1F2C34] px-3 py-2.5 flex items-center gap-2 border-t border-white/5">
          <div className="flex-1 bg-[#2A3942] rounded-full px-3 py-1.5">
            <p className="text-white/20 text-[10px]">Mensagem</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -left-8 top-16 bg-[#050814] border border-[#FF5300]/30 rounded-xl px-3 py-2 shadow-lg shadow-black/40 animate-float-slow" style={{ animationDelay: '1s' }}>
        <p className="text-[#FF5300] text-xs font-semibold font-sans">4 produtos</p>
        <p className="text-white/50 text-[9px] font-sans">portfólio VS</p>
      </div>
      <div className="absolute -right-6 bottom-24 bg-[#050814] border border-green-500/30 rounded-xl px-3 py-2 shadow-lg shadow-black/40 animate-float" style={{ animationDelay: '2s' }}>
        <p className="text-green-400 text-xs font-semibold font-sans">10 dias</p>
        <p className="text-white/50 text-[9px] font-sans">implantação</p>
      </div>
    </div>
  );
}

/* ── Animated headline words ── */
function AnimatedHeadline() {
  const words = ['Sua empresa tem potencial.', 'A VS transforma', 'isso em resultado.'];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = words.map((_, i) =>
      setTimeout(() => setStep(i + 1), i * 350 + 200)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight italic mb-6">
      <span
        className={`block transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        Sua empresa tem
      </span>
      <span
        className={`block transition-all duration-500 delay-150 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        potencial.
      </span>
      <span
        className={`block transition-all duration-500 delay-300 text-[#FF5300] ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        A VS transforma isso em resultado.
      </span>
    </h1>
  );
}

/* ── Scroll indicator ── */
function ScrollIndicator() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-float">
      <span className="text-white/20 text-[10px] font-sans uppercase tracking-widest">scroll</span>
      <ChevronDown className="w-4 h-4 text-white/20" />
    </div>
  );
}

/* ── Main ── */
export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  /* Mouse parallax on desktop */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      const dx = (e.clientX / w - 0.5) * 20;
      const dy = (e.clientY / h - 0.5) * 10;
      el.style.setProperty('--mx', `${dx}px`);
      el.style.setProperty('--my', `${dy}px`);
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <section
      id="hero"
      ref={containerRef}
      className="relative min-h-screen bg-[#050814] flex items-center overflow-hidden pt-16"
      style={{ '--mx': '0px', '--my': '0px' } as React.CSSProperties}
    >
      {/* ── Animated grid ── */}
      <div
        className="absolute inset-0 animate-grid-pulse"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,83,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,83,0,0.07) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Beam sweep ── */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <div
          className="absolute top-0 h-px w-1/3 animate-beam"
          style={{ background: 'linear-gradient(90deg, transparent, #FF5300, transparent)' }}
        />
      </div>

      {/* ── Background orbs ── */}
      <div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,83,0,0.08) 0%, transparent 70%)',
          transform: 'translate(calc(var(--mx) * 0.6), calc(var(--my) * 0.6))',
          transition: 'transform 0.15s ease-out',
          animation: 'orb-drift 18s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(255,83,0,0.05) 0%, transparent 70%)',
          transform: 'translate(calc(var(--mx) * -0.4), calc(var(--my) * -0.4))',
          transition: 'transform 0.15s ease-out',
          animation: 'orb-drift 14s ease-in-out infinite reverse',
        }}
      />

      {/* ── Particles ── */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: '#FF5300',
            opacity: p.opacity,
            animation: `particle-rise ${p.duration} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}

      {/* ── Diagonal accent line ── */}
      <div
        className="absolute top-0 right-0 w-px h-full pointer-events-none opacity-10"
        style={{ background: 'linear-gradient(180deg, transparent, #FF5300 40%, transparent)' }}
      />

      {/* ── Content ── */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            {/* Logo mark */}
            <div className="mb-8 animate-reveal-up" style={{ animationDelay: '0ms' }}>
              <VSLogo size="lg" />
            </div>

            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 bg-[#FF5300]/10 border border-[#FF5300]/30 rounded-full px-3 py-1 mb-6 animate-reveal-up"
              style={{ animationDelay: '100ms' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5300] animate-pulse" />
              <span className="text-[#FF5300] text-xs font-sans font-semibold uppercase tracking-widest">
                Consultoria + IA · Vendas, Marketing e Operações
              </span>
            </div>

            {/* Headline — animated */}
            <div className="animate-reveal-up" style={{ animationDelay: '200ms' }}>
              <AnimatedHeadline />
            </div>

            {/* Sub */}
            <p
              className="font-sans text-white/55 text-base sm:text-lg leading-relaxed mb-8 max-w-lg animate-reveal-up"
              style={{ animationDelay: '350ms' }}
            >
              Da automação de vendas à inteligência nos departamentos — a VS implanta IA em cada área da sua empresa com estratégia, acompanhamento e resultado mensurável em até 10 dias.
            </p>

            {/* Stats row */}
            <div
              className="flex flex-wrap gap-6 mb-10 animate-reveal-up"
              style={{ animationDelay: '450ms' }}
            >
              {[
                { v: '4', l: 'Produtos VS' },
                { v: '+16%', l: 'Eficiência média' },
                { v: '10 dias', l: 'Implantação' },
              ].map(({ v, l }) => (
                <div key={l}>
                  <p className="font-display font-black text-2xl text-white italic leading-none">
                    {v}
                  </p>
                  <p className="font-sans text-white/35 text-[10px] uppercase tracking-widest mt-0.5">{l}</p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-4 animate-reveal-up"
              style={{ animationDelay: '550ms' }}
            >
              <button
                onClick={() => openVSChat()}
                className="group inline-flex items-center justify-center gap-2 bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold px-6 py-3.5 rounded-md transition-all duration-200 hover:shadow-lg hover:shadow-[#FF5300]/30 hover:-translate-y-0.5"
              >
                Quero um diagnóstico gratuito
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#solucao"
                className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-[#FF5300]/40 text-white/70 hover:text-white font-sans font-medium px-6 py-3.5 rounded-md transition-all duration-200 hover:-translate-y-0.5"
              >
                Ver nossos produtos
              </a>
            </div>
          </div>

          {/* Right — mockup */}
          <div
            className="animate-reveal-right"
            style={{
              animationDelay: '300ms',
              transform: 'translate(calc(var(--mx) * 0.3), calc(var(--my) * 0.3))',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <ChatMockup />
          </div>
        </div>
      </div>

      <ScrollIndicator />
    </section>
  );
}
