import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import VSLogo from './VSLogo';
import { openVSChat } from './VSChatAgent';

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { label: 'Solução', href: '#solucao' },
    { label: 'Números', href: '#numeros' },
    { label: 'Nichos', href: '#nichos' },
    { label: 'Como Funciona', href: '#como-funciona' },
    { label: 'ROI', href: '#roi' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#050814]/95 backdrop-blur-md border-b border-white/8 shadow-lg shadow-black/30'
          : 'bg-transparent'
      }`}
    >
      {!scrolled && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF5300]/40 to-transparent" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#hero">
            <VSLogo size="sm" />
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-sans font-medium text-white/60 hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <button
              onClick={() => openVSChat()}
              className="inline-flex items-center gap-2 bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold text-sm px-4 py-2 rounded-md transition-all hover:shadow-md hover:shadow-[#FF5300]/30"
            >
              Falar agora
            </button>
          </div>

          <button
            className="md:hidden text-white p-2"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#050814] border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-sans font-medium text-white/70 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={() => { setOpen(false); openVSChat(); }}
            className="inline-flex justify-center bg-[#FF5300] hover:bg-orange-400 text-white font-sans font-semibold text-sm px-4 py-2 rounded-md transition-colors"
          >
            Falar agora
          </button>
        </div>
      )}
    </nav>
  );
}
