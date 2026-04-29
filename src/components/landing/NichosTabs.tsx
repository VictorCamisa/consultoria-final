import { useState } from 'react';
import { Sparkles, Stethoscope, Scale, Car } from 'lucide-react';

interface Nicho {
  id: string;
  label: string;
  icon: React.ElementType;
  dor: string;
  solucao: string;
  resultado: string;
}

const nichos: Nicho[] = [
  {
    id: 'estetica',
    label: 'Estética',
    icon: Sparkles,
    dor: 'Clínicas de estética perdem até 60% dos leads por demora no retorno. Clientes pesquisam em 3–5 clínicas simultaneamente e fecham com quem responde primeiro. Agendamentos por WhatsApp viram caos sem sistema.',
    solucao:
      'O VS Sales responde em segundos, qualifica o interesse (procedimento, urgência, orçamento), agenda direto no calendário e envia confirmação + lembrete automático — tudo sem humano.',
    resultado:
      'Clínicas parceiras relatam +35% em agendamentos confirmados e redução de 70% no no-show com lembretes automatizados.',
  },
  {
    id: 'odonto',
    label: 'Odonto',
    icon: Stethoscope,
    dor: 'Consultórios odontológicos têm pico de interesse no primeiro contato, mas recepcionistas não conseguem atender todos simultaneamente. Leads de procedimentos de alto ticket (implante, facetas) somem no silêncio.',
    solucao:
      'O agente qualifica interesse em procedimento, simula orçamento baseado no menu de preços da clínica, agenda avaliação gratuita e faz follow-up automático com os não-respondentes.',
    resultado:
      'Parceiros relatam agendamentos de avaliação triplicados e ticket médio 20% maior por melhor qualificação antes do atendimento presencial.',
  },
  {
    id: 'advocacia',
    label: 'Advocacia',
    icon: Scale,
    dor: 'Escritórios de advocacia recebem consultas de casos inviáveis que consomem o tempo dos sócios. Casos de alto valor são perdidos porque a resposta demorou mais de 2 horas — concorrente ágil ganhou o cliente.',
    solucao:
      'O VS Sales faz triagem inteligente: identifica área do direito, urgência e viabilidade. Casos elegíveis são agendados para consulta; casos inviáveis recebem indicação cortês. Sócios só falam com leads qualificados.',
    resultado:
      'Escritórios parceiros reduziram 80% das consultas não-qualificadas e aumentaram taxa de conversão para contratos em 28%.',
  },
  {
    id: 'revendas',
    label: 'Revendas de Veículos',
    icon: Car,
    dor: 'Revendas recebem centenas de consultas mensais. Vendedores demoram para responder, mandam tabelas em PDF ilegíveis e perdem leads para concessionárias com resposta instantânea. Negociação se arrasta por dias.',
    solucao:
      'O agente responde com detalhes do veículo consultado, simula financiamento em segundos, qualifica intenção de compra e marca test-drive. Para interessados quentes, faz handoff imediato para o vendedor humano.',
    resultado:
      'Revendas parceiras registram 3x mais test-drives agendados e ciclo de venda 40% mais curto com qualificação prévia da IA.',
  },
];

export default function NichosTabs() {
  const [selected, setSelected] = useState(nichos[0].id);
  const active = nichos.find((n) => n.id === selected)!;
  const Icon = active.icon;

  return (
    <section id="nichos" className="bg-[#050814] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300] mb-3">
            Nichos Atendidos
          </p>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-white italic">
            A VS já fala o idioma do seu mercado
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {nichos.map(({ id, label, icon: TabIcon }) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-sans text-sm font-semibold transition-all ${
                selected === id
                  ? 'bg-[#FF5300] text-white'
                  : 'bg-[#0D1117] border border-white/10 text-white/50 hover:text-white hover:border-white/30'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div
          key={selected}
          className="bg-[#0D1117] border border-white/10 rounded-2xl p-8 lg:p-10 animate-fade-in"
        >
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Dor */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <span className="text-red-400 text-sm font-bold">!</span>
                </div>
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-red-400">
                  O problema
                </p>
              </div>
              <p className="font-sans text-white/60 text-sm leading-relaxed">{active.dor}</p>
            </div>

            {/* Solução */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF5300]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#FF5300]" />
                </div>
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#FF5300]">
                  Como a VS resolve
                </p>
              </div>
              <p className="font-sans text-white/60 text-sm leading-relaxed">{active.solucao}</p>
            </div>

            {/* Resultado */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-400 text-sm font-bold">↑</span>
                </div>
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-green-400">
                  Resultado esperado
                </p>
              </div>
              <p className="font-sans text-white/60 text-sm leading-relaxed">{active.resultado}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
