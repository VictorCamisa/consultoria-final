import { useState } from 'react';
import { Calculator } from 'lucide-react';

const WS_NUMBER = '5512999999999';

export default function ROICalculator() {
  const [leadsPerMonth, setLeadsPerMonth] = useState(80);
  const [ticketMedio, setTicketMedio] = useState(2000);
  const [vendedores, setVendedores] = useState(2);

  const taxaPerda = 0.4;
  const melhoriaConversao = 0.16;
  const custoVS = 800;

  const leadsPerdisosMes = Math.round(leadsPerMonth * taxaPerda);
  const receitaPerda = leadsPerdisosMes * ticketMedio * melhoriaConversao;
  const roi = receitaPerda / custoVS;

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <section id="roi" className="bg-[#050814] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Calculadora de ROI
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic mb-4">
            Quanto você está perdendo agora?
          </h2>
          <p className="font-sans text-white/50 text-base max-w-xl mx-auto">
            Ajuste os sliders abaixo com os dados do seu negócio e veja o impacto real em segundos.
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
                  Ticket médio
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

            {/* Vendedores */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-sans text-sm font-semibold text-white/80">
                  Nº de vendedores
                </label>
                <span className="font-display font-black text-xl text-[#FF5300] italic">
                  {vendedores}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={vendedores}
                onChange={(e) => setVendedores(Number(e.target.value))}
                className="w-full accent-[#FF5300] cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-white/30 text-xs font-sans">1</span>
                <span className="text-white/30 text-xs font-sans">10</span>
              </div>
            </div>

            {/* Premissas */}
            <div className="bg-[#050814] rounded-lg p-4 space-y-1.5">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">
                Premissas utilizadas
              </p>
              <p className="font-sans text-xs text-white/40">• 40% de leads perdidos por demora</p>
              <p className="font-sans text-xs text-white/40">• +16% de conversão vs. humano (dado VS)</p>
              <p className="font-sans text-xs text-white/40">• VS Sales base: R$800/mês</p>
            </div>
          </div>

          {/* Output */}
          <div className="flex flex-col gap-5">
            {/* Main result */}
            <div className="bg-[#FF5300]/10 border border-[#FF5300]/30 rounded-2xl p-8 flex-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
                Você está perdendo todo mês
              </p>
              <p className="font-display font-black text-5xl sm:text-6xl text-white italic mb-2">
                {fmt(receitaPerda)}
              </p>
              <p className="font-sans text-white/50 text-sm">
                {leadsPerdisosMes} leads perdidos × {fmt(ticketMedio)} × 16% de melhoria
              </p>
            </div>

            {/* ROI */}
            <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                    ROI estimado com VS Sales
                  </p>
                  <p className="font-display font-black text-3xl text-white italic">
                    {roi.toFixed(1)}
                    <span className="text-[#FF5300]">×</span> o investimento
                  </p>
                </div>
                <Calculator className="w-10 h-10 text-[#FF5300]/30" />
              </div>
            </div>

            {/* Cost comparison */}
            <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-sans text-sm text-white/60">Custo VS Sales</p>
                <p className="font-display font-black text-xl text-white italic">{fmt(custoVS)}/mês</p>
              </div>
              <div className="h-px bg-white/5 mb-4" />
              <p className="font-sans text-xs text-white/40 text-center">
                Retorno potencial de {fmt(receitaPerda)}/mês pagando apenas {fmt(custoVS)}/mês
              </p>
            </div>

            {/* CTA */}
            <a
              href={`https://wa.me/${WS_NUMBER}?text=Quero%20calcular%20meu%20ROI%20com%20a%20VS!`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold px-6 py-3.5 rounded-md transition-colors text-center"
            >
              Quero recuperar esses leads agora
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
