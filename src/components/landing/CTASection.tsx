import { useState } from 'react';
import { MessageCircle, Send, CheckCircle2, Loader2 } from 'lucide-react';

interface CTASectionProps {
  whatsappNumber: string;
}

type Nicho = 'estetica' | 'odonto' | 'advocacia' | 'revendas' | 'outro';

interface FormState {
  nome: string;
  empresa: string;
  nicho: Nicho | '';
  whatsapp: string;
  mensagem: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function maskPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return raw;
}

export default function CTASection({ whatsappNumber }: CTASectionProps) {
  const waLink = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1%2C%20quero%20um%20diagn%C3%B3stico%20gratuito%20com%20a%20VS!`;

  const [form, setForm] = useState<FormState>({
    nome: '',
    empresa: '',
    nicho: '',
    whatsapp: '',
    mensagem: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.empresa || !form.nicho || !form.whatsapp) return;
    setLoading(true);
    setError('');

    const digits = form.whatsapp.replace(/\D/g, '');
    const whatsappE164 = digits.length === 11 ? `55${digits}` : digits;

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/landing-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          nome: form.nome,
          empresa: form.empresa,
          nicho: form.nicho as Nicho,
          whatsapp: whatsappE164,
          mensagem: form.mensagem,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar formulário');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contato" className="bg-[#FF5300] py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="font-display font-black text-4xl sm:text-5xl text-white italic mb-4">
            Pronto para transformar sua empresa com IA?
          </h2>
          <p className="font-sans text-white/80 text-lg max-w-xl mx-auto">
            Comece com um diagnóstico gratuito de 30 minutos. Identificamos onde estão suas maiores oportunidades — em vendas, marketing ou operações.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 max-w-4xl mx-auto">
          {/* WhatsApp CTA */}
          <div className="bg-white/10 rounded-2xl p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-display font-black text-2xl text-white italic mb-3">
              Resposta em minutos
            </h3>
            <p className="font-sans text-white/70 text-sm mb-6">
              Fale direto com um especialista VS via WhatsApp. Sem robô, sem fila de espera.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-[#FF5300] hover:bg-orange-50 font-sans font-bold px-6 py-3.5 rounded-md transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Quero meu diagnóstico gratuito
            </a>
          </div>

          {/* Form */}
          <div className="bg-white/10 rounded-2xl p-8">
            {success ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-white mb-4" />
                <h3 className="font-display font-black text-2xl text-white italic mb-2">
                  Recebemos seu contato!
                </h3>
                <p className="font-sans text-white/70 text-sm">
                  Nossa equipe vai entrar em contato no WhatsApp informado em até 2 horas.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-display font-black text-xl text-white italic mb-6">
                  Ou deixe seus dados
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Seu nome *"
                    value={form.nome}
                    onChange={(e) => set('nome', e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-4 py-2.5 text-white placeholder-white/40 text-sm font-sans focus:outline-none focus:border-white/60 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Nome da empresa *"
                    value={form.empresa}
                    onChange={(e) => set('empresa', e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-4 py-2.5 text-white placeholder-white/40 text-sm font-sans focus:outline-none focus:border-white/60 transition-colors"
                  />
                  <select
                    value={form.nicho}
                    onChange={(e) => set('nicho', e.target.value)}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-4 py-2.5 text-white text-sm font-sans focus:outline-none focus:border-white/60 transition-colors [&>option]:bg-[#050814] [&>option]:text-white"
                  >
                    <option value="" disabled>
                      Seu nicho *
                    </option>
                    <option value="estetica">Estética</option>
                    <option value="odonto">Odontologia</option>
                    <option value="advocacia">Advocacia</option>
                    <option value="revendas">Revendas de Veículos</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="WhatsApp (com DDD) *"
                    value={form.whatsapp}
                    onChange={(e) => set('whatsapp', maskPhone(e.target.value))}
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-md px-4 py-2.5 text-white placeholder-white/40 text-sm font-sans focus:outline-none focus:border-white/60 transition-colors"
                  />
                  <textarea
                    placeholder="O que você quer transformar na empresa? (opcional)"
                    value={form.mensagem}
                    onChange={(e) => set('mensagem', e.target.value)}
                    rows={2}
                    className="w-full bg-white/10 border border-white/20 rounded-md px-4 py-2.5 text-white placeholder-white/40 text-sm font-sans focus:outline-none focus:border-white/60 transition-colors resize-none"
                  />
                  {error && (
                    <p className="text-white/80 text-xs font-sans bg-black/20 rounded px-3 py-2">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#FF5300] hover:bg-orange-50 disabled:opacity-60 font-sans font-bold px-6 py-3 rounded-md transition-colors"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {loading ? 'Enviando...' : 'Enviar dados'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
