import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
}

const stats: Stat[] = [
  { value: 2500, suffix: '+', label: 'Leads gerados' },
  { value: 180, suffix: 'k', label: 'Mensagens de IA' },
  { value: 40, suffix: '%', label: 'Ganho de eficiência' },
  { value: 16, suffix: '%', prefix: '+', label: 'Superior ao humano' },
  { value: 98.9, suffix: '%', label: 'Assertividade' },
];

function useCountUp(target: number, active: boolean, duration = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, active, duration]);

  return count;
}

function StatItem({ stat, active }: { stat: Stat; active: boolean }) {
  const count = useCountUp(stat.value, active);
  const display = stat.value % 1 !== 0 ? count.toFixed(1) : Math.round(count).toLocaleString('pt-BR');

  return (
    <div className="text-center px-6 py-4">
      <div className="font-display font-black text-4xl sm:text-5xl text-white italic mb-2">
        {stat.prefix && <span className="text-[#FF5300]">{stat.prefix}</span>}
        {display}
        <span className="text-[#FF5300]">{stat.suffix}</span>
      </div>
      <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/40">
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
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="numeros" className="bg-[#0D1117] py-20 px-4 sm:px-6 lg:px-8 border-y border-white/5" ref={ref}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300]">
            Resultados reais
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 divide-x divide-white/5">
          {stats.map((stat) => (
            <StatItem key={stat.label} stat={stat} active={active} />
          ))}
        </div>
      </div>
    </section>
  );
}
