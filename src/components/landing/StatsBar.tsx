import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
}

const stats: Stat[] = [
  { value: 4, suffix: '', label: 'Produtos VS' },
  { value: 10, suffix: ' dias', label: 'Implantação média' },
  { value: 40, suffix: '%', label: 'Ganho de eficiência' },
  { value: 80, suffix: '%', label: 'Redução de tarefas manuais' },
  { value: 100, suffix: '%', label: 'Sem código da sua parte' },
];

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, active, duration]);

  return count;
}

function StatItem({ stat, active, delay }: { stat: Stat; active: boolean; delay: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);

  const count = useCountUp(stat.value, started);
  const display = stat.value % 1 !== 0 ? count.toFixed(1) : Math.round(count).toLocaleString('pt-BR');

  return (
    <div
      className={`text-center px-6 py-6 transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="font-display font-black text-4xl sm:text-5xl text-white italic mb-2 leading-none">
        {stat.prefix && <span className="text-[#FF5300]">{stat.prefix}</span>}
        {display}
        <span className="text-[#FF5300]">{stat.suffix}</span>
      </div>
      <p className="font-sans text-[10px] font-semibold uppercase tracking-widest text-white/35">
        {stat.label}
      </p>
    </div>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="numeros"
      ref={ref}
      className="relative bg-[#0D1117] py-20 px-4 sm:px-6 lg:px-8 border-y border-white/5 overflow-hidden"
    >
      {/* Beam sweep */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <div
          className="absolute top-0 h-px w-1/3 animate-beam"
          style={{ background: 'linear-gradient(90deg, transparent, #FF5300, transparent)' }}
        />
      </div>

      <div className="max-w-7xl mx-auto">
        <div className={`text-center mb-8 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0'}`}>
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300]">
            Resultados reais
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 divide-x divide-white/5">
          {stats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} active={active} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}
