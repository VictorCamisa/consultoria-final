import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, ChevronRight, Send, CheckCircle2, Loader2 } from 'lucide-react';

// ── Global trigger ──────────────────────────────────────────────────────────
export function openVSChat(product?: string) {
  window.dispatchEvent(new CustomEvent('vs-chat-open', { detail: { product } }));
}

// ── Types ───────────────────────────────────────────────────────────────────
type StepId = 'welcome' | 'product' | 'nicho' | 'pain' | 'faq-answer' | 'contact' | 'done' | 'bye';

type Msg = { from: 'bot' | 'user'; text: string };
type Opt = { label: string; value: string };

// ── Static data ─────────────────────────────────────────────────────────────
const PRODUCT_DESC: Record<string, string> = {
  'VS Sales':
    'Agente IA que responde, qualifica e converte leads no WhatsApp 24/7. Sem demora, sem lead perdido.',
  'VS Marketing':
    'Conteúdo estratégico, gestão de tráfego pago e automação de campanhas integrada ao seu funil.',
  'VS Departamentos':
    'IA nos processos internos: atendimento, RH, financeiro e operações — sem precisar de equipe de TI.',
  'VS 360':
    'Stack completo: Sales + Marketing + Departamentos com acompanhamento semanal do time VS.',
};

const FAQ_ANSWERS: Record<string, string> = {
  'Preços e planos':
    'Nossos planos vão de R$800/mês (VS Sales) a R$12.000/mês (VS 360 completo). Antes de qualquer proposta, fazemos um diagnóstico gratuito — sem compromisso.',
  'Como funciona a IA':
    'A IA é treinada com o contexto do seu negócio: linguagem, produtos, objeções. Ela atua como um colaborador que nunca dorme — responde, qualifica e aciona seu time humano no momento certo.',
  'Tempo de implantação':
    'A implantação padrão é até 10 dias úteis, incluindo configuração, integração com seus canais e testes. Projetos maiores (VS 360) podem levar até 21 dias.',
  'Se funciona pro meu nicho':
    'Já atendemos estética, odonto, advocacia, revendas e outros segmentos. Todos os produtos são configurados com o contexto do seu mercado. O diagnóstico gratuito avalia a viabilidade sem compromisso.',
};

const NICHO_OPTIONS: Opt[] = [
  { label: '💆 Estética', value: 'estetica' },
  { label: '🦷 Odontologia', value: 'odonto' },
  { label: '⚖️ Advocacia', value: 'advocacia' },
  { label: '🚗 Revendas de Veículos', value: 'revendas' },
  { label: '🏢 Outro', value: 'outro' },
];

// ── Env ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function VSChatAgent() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<StepId>('welcome');
  const [opts, setOpts] = useState<Opt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [ctx, setCtx] = useState<Record<string, string>>({});
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const bot = (text: string) => setMsgs((m) => [...m, { from: 'bot', text }]);
  const user = (text: string) => setMsgs((m) => [...m, { from: 'user', text }]);

  const reset = (product?: string) => {
    setMsgs([]);
    setStep('welcome');
    setOpts([]);
    setShowForm(false);
    setCtx(product ? { produto: product } : {});
    setNome(''); setEmpresa(''); setPhone('');
    setSubmitting(false); setSubmitError(''); setDone(false);
  };

  // ── Open via global event ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const product = (e as CustomEvent).detail?.product as string | undefined;
      reset(product);
      setOpen(true);
    };
    window.addEventListener('vs-chat-open', handler);
    return () => window.removeEventListener('vs-chat-open', handler);
  }, []);

  // ── Start conversation when opened ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const t1 = setTimeout(() => bot('Olá! Sou a Ana, consultora virtual da VS 👋'), 200);
    const t2 = setTimeout(() => {
      // If a product was pre-selected, skip the initial menu
      if (ctx.produto) {
        const desc = PRODUCT_DESC[ctx.produto];
        bot(`Vi que você tem interesse no ${ctx.produto}${desc ? `: ${desc}` : ''}. Qual é o seu nicho de mercado?`);
        setStep('nicho');
        setOpts(NICHO_OPTIONS);
      } else {
        bot('Como posso te ajudar hoje?');
        setStep('welcome');
        setOpts([
          { label: 'Quero conhecer os produtos', value: 'produtos' },
          { label: 'Tenho interesse em contratar', value: 'contratar' },
          { label: 'Tenho uma dúvida', value: 'duvida' },
        ]);
      }
    }, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, opts, showForm]);

  // ── Option selected ──────────────────────────────────────────────────────
  const pick = (opt: Opt) => {
    setOpts([]);
    user(opt.label);

    setTimeout(() => {
      if (step === 'welcome') {
        if (opt.value === 'produtos') {
          bot('Atuamos em 4 frentes. Qual mais te interessa?');
          setStep('product');
          setOpts(Object.keys(PRODUCT_DESC).map((k) => ({ label: k, value: k })));
        } else if (opt.value === 'contratar') {
          bot('Excelente! Qual é o seu nicho de mercado?');
          setStep('nicho');
          setOpts(NICHO_OPTIONS);
        } else {
          bot('Claro! Qual das opções mais se aproxima da sua dúvida?');
          setStep('faq-answer');
          setOpts(Object.keys(FAQ_ANSWERS).map((k) => ({ label: k, value: k })));
        }
        return;
      }

      if (step === 'product') {
        setCtx((c) => ({ ...c, produto: opt.value }));
        bot(`${opt.value}: ${PRODUCT_DESC[opt.value]}`);
        setTimeout(() => {
          bot('Qual é o seu nicho de mercado?');
          setStep('nicho');
          setOpts(NICHO_OPTIONS);
        }, 700);
        return;
      }

      if (step === 'nicho') {
        setCtx((c) => ({ ...c, nicho: opt.value }));
        bot('Qual é a sua maior dor hoje?');
        setStep('pain');
        setOpts([
          { label: 'Perco muitos leads', value: 'leads' },
          { label: 'Processos manuais me travam', value: 'processos' },
          { label: 'Quero mais clientes', value: 'clientes' },
          { label: 'Quero automatizar tudo', value: 'automacao' },
        ]);
        return;
      }

      if (step === 'pain') {
        setCtx((c) => ({ ...c, dor: opt.value }));
        bot('Perfeito! Para agendar seu diagnóstico gratuito, me passa seus dados:');
        setStep('contact');
        setShowForm(true);
        return;
      }

      if (step === 'faq-answer') {
        const answer = FAQ_ANSWERS[opt.value] ?? 'Ótima pergunta! Um especialista pode responder melhor.';
        bot(answer);
        setTimeout(() => {
          bot('Quer conversar com um especialista VS para saber mais?');
          setStep('contact');
          setOpts([
            { label: 'Sim, quero agendar!', value: 'sim' },
            { label: 'Não, obrigado', value: 'nao' },
          ]);
        }, 700);
        return;
      }

      if (step === 'contact') {
        if (opt.value === 'sim') {
          bot('Ótimo! Me passa seus dados:');
          setShowForm(true);
        } else {
          bot('Tudo certo! 😊 Fico aqui se precisar. Aproveite para explorar o site!');
          setStep('bye');
        }
      }
    }, 350);
  };

  // ── Form submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !phone.trim()) return;
    setSubmitting(true);
    setSubmitError('');

    const digits = phone.replace(/\D/g, '');
    const e164 = digits.length === 11 ? `55${digits}` : digits;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/landing-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          empresa: empresa.trim() || 'Não informado',
          nicho: (ctx.nicho as any) || 'outro',
          whatsapp: e164,
          mensagem: [ctx.produto, ctx.dor].filter(Boolean).join(' | '),
        }),
      });
      if (!res.ok) throw new Error('erro');

      setShowForm(false);
      user(`${nome} — ${phone}`);
      setTimeout(() => {
        bot(`Recebido, ${nome.split(' ')[0]}! 🎉 Nossa equipe entrará em contato no WhatsApp em até 2 horas. Até logo!`);
        setDone(true);
        setStep('done');
      }, 350);
    } catch {
      setSubmitError('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => { reset(); setOpen(true); }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#FF5300] hover:bg-orange-400 shadow-lg shadow-[#FF5300]/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          aria-label="Falar com a VS"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#050814] animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-[360px] bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 3rem)' }}>

          {/* Header */}
          <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-black font-display italic">VS</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">Ana · VS Soluções</p>
              <p className="text-green-300 text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                online agora
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white p-1 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
            style={{ background: 'linear-gradient(180deg,#0A1014 0%,#0D1117 100%)' }}
          >
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed text-white/90 ${
                    m.from === 'bot' ? 'rounded-tl-none bg-[#1F2C34]' : 'rounded-tr-none bg-[#005C4B]'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Quick-reply options */}
            {opts.length > 0 && (
              <div className="flex flex-col gap-1.5 pl-1 pt-1">
                {opts.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => pick(o)}
                    className="text-left text-xs text-[#FF5300] border border-[#FF5300]/30 bg-[#FF5300]/5 hover:bg-[#FF5300]/15 rounded-xl px-3 py-2 transition-colors flex items-center gap-2"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {o.label}
                  </button>
                ))}
              </div>
            )}

            {/* Contact form */}
            {showForm && (
              <form onSubmit={handleSubmit} className="bg-[#1F2C34] rounded-xl p-3 space-y-2 ml-1 mt-1">
                <input
                  type="text"
                  placeholder="Seu nome *"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#FF5300]/50 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Empresa (opcional)"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#FF5300]/50 transition-colors"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp (com DDD) *"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  required
                  className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#FF5300]/50 transition-colors"
                />
                {submitError && <p className="text-red-400 text-[10px]">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#FF5300] hover:bg-orange-400 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  {submitting ? 'Enviando...' : 'Agendar diagnóstico gratuito'}
                </button>
              </form>
            )}

            {/* Done confirmation */}
            {done && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-green-500/10 border border-green-500/20 px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <p className="text-green-400 text-xs font-semibold">Contato recebido!</p>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </>
  );
}
