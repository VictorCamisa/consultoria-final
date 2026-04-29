import { Zap, Instagram, Linkedin } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="bg-[#050814] border-t border-white/5 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#FF5300] rounded flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" fill="currentColor" />
              </div>
              <span className="font-display font-black text-white tracking-tight text-lg">
                VS <span className="text-[#FF5300]">Soluções</span>
              </span>
            </div>
            <p className="font-sans text-white/40 text-sm leading-relaxed max-w-xs">
              Agentes de IA para vendas e operações via WhatsApp. Implantação rápida, resultado mensurável.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://instagram.com/vssolucoes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-white/50" />
              </a>
              <a
                href="https://linkedin.com/company/vssolucoes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 text-white/50" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
              Produtos
            </p>
            <ul className="space-y-2.5">
              {['VS Sales', 'VS Marketing', 'VS Departamentos', 'VS 360'].map((p) => (
                <li key={p}>
                  <a
                    href="#solucao"
                    className="font-sans text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
              Empresa
            </p>
            <ul className="space-y-2.5">
              {[
                { label: 'Nichos atendidos', href: '#nichos' },
                { label: 'Como funciona', href: '#como-funciona' },
                { label: 'Calculadora ROI', href: '#roi' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Política de privacidade', href: '#privacidade' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="font-sans text-sm text-white/50 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-sans text-xs text-white/20">
            © {new Date().getFullYear()} VS Soluções. CNPJ 00.000.000/0001-00. Todos os direitos reservados.
          </p>
          <p className="font-sans text-xs text-white/20">
            Feito com IA por VS Soluções
          </p>
        </div>
      </div>
    </footer>
  );
}
