import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { openVSChat } from './VSChatAgent';

export default function ROICalculator() {
  const [leadsPerMonth, setLeadsPerMonth] = useState(80);
  const [ticketMedio, setTicketMedio] = useState(2000);
  const [horasProcessos, setHorasProcessos] = useState(20);

  const taxaPerda = 0.4;
  const melhoriaConversao = 0.16;
  const custoHora = 50;

  const leadsPerdisosMes = Math.round(leadsPerMonth * taxaPerda);
  const receitaPerda = leadsPerdisosMes * ticketMedio * melhoriaConversao;
  const economiaProcessos = horasProcessos * custoHora * 4; // 4 semanas
  const impactoTotal = receitaPerda + economiaProcessos;

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <section id="roi" className="bg-[#050814] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Calculadora de Impacto
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic mb-4">
            Quanto sua empresa pode recuperar?
          </h2>
          <p className="font-sans text-white/50 text-base max-w-xl mx-auto">
            Ajuste os números abaixo e veja o impacto combinado de vendas + automação de processos no seu resultado mensal.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Inputs */}
          <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-8 space-y-8">
            {/* Leads/mês */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-sans text-sm font-semibold text-white/80">
                  Leads por mês
                </label>
                <span className="font-display font-black text-xl text-[#FF5300] italic">
                  {leadsPerMonth}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={leadsPerMonth}
                onChange={(e) => setLeadsPerMonth(Number(e.target.value))}
                className="w-full accent-[#FF5300] cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-white/30 text-xs font-sans">10</span>
                <span className="text-white/30 text-xs font-sans">500</span>
              </div>
            </div>

            {/* Ticket médio */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-sans text-sm font-semibold text-white/80">
                  Ticket médio por venda
                </label>
                <span className="font-display font-black text-xl text-[#FF5300] italic">
                  {fmt(ticketMedio)}
                </span>
              </div>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                value={ticketMedio}
                onChange={(e) => setTicketMedio(Number(e.target.value))}
                className="w-full accent-[#FF5300] cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-white/30 text-xs font-sans">R$500</span>
                <span className="text-white/30 text-xs font-sans">R$50k</span>
              </div>
            </div>

            {/* Horas em processos manuais */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-sans text-sm font-semibold text-white/80">
                  Horas/semana em tarefas manuais
                </label>
                <span className="font-display font-black text-xl text-[#FF5300] italic">
                  {horasProcessos}h
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={80}
                step={2}
                value={horasProcessos}
                onChange={(e) => setHorasProcessos(Number(e.target.value))}
                className="w-full accent-[#FF5300] cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-white/30 text-xs font-sans">2h</span>
                <span className="text-white/30 text-xs font-sans">80h</span>
              </div>
            </div>

            {/* Premissas */}
            <div className="bg-[#050814] rounded-lg p-4 space-y-1.5">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">
                Premissas utilizadas
              </p>
              <p className="font-sans text-xs text-white/40">• 40% de leads perdidos por demora no atendimento</p>
              <p className="font-sans text-xs text-white/40">• +16% de melhoria de conversão com VS Sales</p>
              <p className="font-sans text-xs text-white/40">• R$50/h de custo médio de mão de obra manual</p>
            </div>
          </div>

          {/* Output */}
          <div className="flex flex-col gap-5">
            {/* Impacto em vendas */}
            <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                Recuperação em vendas (VS Sales)
              </p>
              <p className="font-display font-black text-3xl text-white italic">
                {fmt(receitaPerda)}<span className="text-[#FF5300] text-lg">/mês</span>
              </p>
              <p className="font-sans text-white/35 text-xs mt-1">
                {leadsPerdisosMes} leads perdidos × {fmt(ticketMedio)} × 16%
              </p>
            </div>

            {/* Economia em processos */}
            <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                Economia em processos (VS Departamentos)
              </p>
              <p className="font-display font-black text-3xl text-white italic">
                {fmt(economiaProcessos)}<span className="text-[#FF5300] text-lg">/mês</span>
              </p>
              <p className="font-sans text-white/35 text-xs mt-1">
                {horasProcessos}h/sem × 4 semanas × R$50/h automatizados
              </p>
            </div>

            {/* Total */}
            <div className="bg-[#FF5300]/10 border border-[#FF5300]/30 rounded-2xl p-8 flex-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
                Impacto total estimado por mês
              </p>
              <p className="font-display font-black text-5xl sm:text-6xl text-white italic mb-2">
                {fmt(impactoTotal)}
              </p>
              <p className="font-sans text-white/50 text-sm">
                Combinando VS Sales + VS Departamentos
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={() => openVSChat()}
              className="inline-flex items-center justify-center gap-2 bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold px-6 py-3.5 rounded-md transition-colors text-center"
            >
              <TrendingUp className="w-4 h-4" />
              Quero esse impacto na minha empresa
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
