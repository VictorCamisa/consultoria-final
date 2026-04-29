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
    dor: 'Clínicas de estética perdem até 60% dos leads por demora no retorno. Agendamentos por WhatsApp viram caos sem sistema, a recepção se sobrecarrega e processos internos (controle de caixa, agenda, estoque) ainda são feitos no papel ou em planilhas.',
    solucao:
      'O VS Sales responde e agenda 24/7. O VS Departamentos automatiza processos internos — controle financeiro, confirmações e lembretes de retorno. Para clínicas que querem crescer, o VS Marketing estrutura conteúdo e tráfego para atrair mais pacientes.',
    resultado:
      'Clínicas parceiras relatam +35% em agendamentos confirmados, redução de 70% no no-show e liberação de horas semanais da equipe com automação de processos administrativos.',
  },
  {
    id: 'odonto',
    label: 'Odonto',
    icon: Stethoscope,
    dor: 'Consultórios odontológicos perdem leads de alto ticket (implante, facetas) porque a recepção não dá conta do volume simultâneo. Além disso, gestão de retornos, cobranças e controle de estoque de materiais consomem tempo precioso da equipe.',
    solucao:
      'O VS Sales qualifica interesse, simula orçamento e agenda avaliação gratuita automaticamente. O VS Departamentos organiza cobranças, retornos e comunicação com pacientes. O VS 360 entrega a transformação completa da operação com acompanhamento semanal.',
    resultado:
      'Parceiros relatam agendamentos de avaliação triplicados, ticket médio 20% maior e economia de até 15h/semana da equipe administrativa com processos automatizados.',
  },
  {
    id: 'advocacia',
    label: 'Advocacia',
    icon: Scale,
    dor: 'Escritórios recebem consultas de casos inviáveis que consomem o tempo dos sócios. Processos internos — controle de prazos, envio de documentos, cobrança de honorários — ainda dependem de e-mails manuais e planilhas pouco confiáveis.',
    solucao:
      'O VS Sales faz triagem inteligente: sócios só falam com leads qualificados. O VS Departamentos automatiza comunicação com clientes, alertas de prazo e fluxo de cobrança de honorários. Tudo integrado, rastreado e com histórico completo.',
    resultado:
      'Escritórios parceiros reduziram 80% das consultas não-qualificadas, aumentaram conversão para contratos em 28% e eliminaram atrasos no envio de documentos com automações.',
  },
  {
    id: 'revendas',
    label: 'Revendas de Veículos',
    icon: Car,
    dor: 'Revendas recebem centenas de consultas mensais. Vendedores demoram para responder, perdem leads para concorrentes com resposta instantânea, e o marketing de anúncios é feito sem estratégia ou mensuração de retorno.',
    solucao:
      'O VS Sales responde com detalhes do veículo, simula financiamento e agenda test-drive automaticamente. O VS Marketing estrutura campanhas pagas e orgânicas com foco em conversão. O VS AUTO oferece um sistema completo de gestão de leads e vendas para revendas.',
    resultado:
      'Revendas parceiras registram 3× mais test-drives agendados, ciclo de venda 40% mais curto e ROI mensurável em cada campanha de marketing — sem achismo.',
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
