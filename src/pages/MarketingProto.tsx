import { useState } from "react";

// Protótipo estático — carrossel V4/G4 brutalista
// Renderiza 5 slides 1080x1080 (escalados pra caber na tela) lado a lado
// Tema: "O custo invisível do vendedor humano"
// Sem IA, sem fetch, sem nada dinâmico. Só HTML/CSS pra você julgar.

const SLIDE_SIZE = 540; // 1080 / 2 — preview

function SlideShell({ children, bg = "bg-black" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div
      className={`relative ${bg} overflow-hidden flex-shrink-0 rounded-md shadow-2xl`}
      style={{ width: SLIDE_SIZE, height: SLIDE_SIZE }}
    >
      {children}
    </div>
  );
}

// ─────────── SLIDE 1: HOOK ───────────
// Fundo preto. Headline brutal quebrada em linhas. Marca laranja no canto.
function Slide1() {
  return (
    <SlideShell>
      {/* barra superior cyber orange */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF5300]" />

      {/* slide number */}
      <div className="absolute top-8 left-8 font-mono text-xs tracking-[0.3em] text-white/40">
        01 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-xs tracking-[0.3em] text-[#FF5300]">
        VS · MANIFESTO
      </div>

      {/* headline gigante — alinhado à esquerda, baixo, italic black */}
      <div className="absolute left-8 right-8 bottom-20">
        <p className="font-mono text-[10px] tracking-[0.4em] text-[#FF5300] uppercase mb-4">
          // o problema que ninguém quer ver
        </p>
        <h1
          className="text-white font-black italic uppercase leading-[0.85] tracking-tight"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 92 }}
        >
          Seu vendedor
          <br />
          custa <span className="text-[#FF5300]">3x</span>
          <br />
          mais do que
          <br />
          você acha.
        </h1>
      </div>

      {/* footer */}
      <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/30">@VSSOLUCOES</span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/40">ARRASTE →</span>
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 2: PROBLEM (split foto + texto) ───────────
function Slide2() {
  return (
    <SlideShell bg="bg-[#0a0a0a]">
      {/* lado esquerdo: "foto" simulada com gradient escuro + grão */}
      <div className="absolute top-0 left-0 bottom-0 w-[55%] bg-gradient-to-br from-neutral-800 via-neutral-900 to-black">
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
          }}
        />
        {/* canto: tag editorial */}
        <div className="absolute bottom-6 left-6 font-mono text-[9px] tracking-[0.3em] text-white/40 uppercase">
          Cena 02 · Realidade do PME brasileiro
        </div>
      </div>

      {/* lado direito: texto */}
      <div className="absolute top-0 right-0 bottom-0 w-[45%] flex flex-col justify-between p-8">
        <div className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300]">02 / 05</div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.4em] text-white/40 uppercase mb-4">
            // diagnóstico
          </p>
          <h2
            className="text-white font-black italic uppercase leading-[0.88] tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif", fontSize: 56 }}
          >
            Treina,
            <br />
            paga,
            <br />
            <span className="text-[#FF5300]">repete.</span>
          </h2>
          <p className="text-white/60 text-sm mt-6 leading-snug max-w-[200px]">
            Salário, comissão, INSS, FGTS, plano. E o cara pede demissão em 8 meses.
          </p>
        </div>

        <div className="font-mono text-[9px] tracking-[0.3em] text-white/30">@VSSOLUCOES</div>
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 3: DATA POINT (número heroico) ───────────
function Slide3() {
  return (
    <SlideShell>
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF5300]" />

      <div className="absolute top-8 left-8 font-mono text-xs tracking-[0.3em] text-white/40">
        03 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-xs tracking-[0.3em] text-[#FF5300]">
        DADO
      </div>

      {/* contexto top */}
      <div className="absolute top-24 left-8 right-8">
        <p className="font-mono text-[10px] tracking-[0.4em] text-white/40 uppercase">
          // pesquisa interna VS · 2025 · n=312
        </p>
      </div>

      {/* NÚMERO GIGANTE — empurrado pra baixo-esquerda */}
      <div className="absolute left-4 bottom-32">
        <div
          className="text-[#FF5300] font-black italic leading-[0.75] tracking-tighter"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 360 }}
        >
          73<span className="text-white/90">%</span>
        </div>
      </div>

      {/* legenda do dado */}
      <div className="absolute bottom-12 right-8 max-w-[260px] text-right">
        <p
          className="text-white font-black italic uppercase leading-[0.95]"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 22 }}
        >
          Dos PMEs perdem o lead<br />em menos de 2 horas.
        </p>
      </div>

      <div className="absolute bottom-4 left-8 font-mono text-[9px] tracking-[0.3em] text-white/30">
        @VSSOLUCOES
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 4: PROCESS (lista numerada brutal) ───────────
function Slide4() {
  return (
    <SlideShell bg="bg-[#0a0a0a]">
      <div className="absolute top-8 left-8 font-mono text-xs tracking-[0.3em] text-white/40">
        04 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-xs tracking-[0.3em] text-[#FF5300]">
        SOLUÇÃO · 3 PASSOS
      </div>

      <div className="absolute top-24 left-8 right-8">
        <p
          className="text-white font-black italic uppercase leading-[0.9]"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 38 }}
        >
          Como a VS<br />resolve isso:
        </p>
      </div>

      {/* lista */}
      <div className="absolute left-8 right-8 bottom-16 space-y-5">
        {[
          { n: "01", t: "Atende em 30s", s: "IA conectada ao seu WhatsApp" },
          { n: "02", t: "Qualifica sozinha", s: "Score MEDDIC automático" },
          { n: "03", t: "Entrega o lead pronto", s: "Você só fecha" },
        ].map((it) => (
          <div key={it.n} className="flex items-baseline gap-6 border-t border-white/10 pt-4">
            <span
              className="text-[#FF5300] font-black italic leading-none"
              style={{ fontFamily: "Poppins, sans-serif", fontSize: 64 }}
            >
              {it.n}
            </span>
            <div className="flex-1">
              <p
                className="text-white font-black italic uppercase leading-tight"
                style={{ fontFamily: "Poppins, sans-serif", fontSize: 26 }}
              >
                {it.t}
              </p>
              <p className="text-white/50 text-xs mt-1">{it.s}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-8 font-mono text-[9px] tracking-[0.3em] text-white/30">
        @VSSOLUCOES
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 5: CTA brutal (NÃO centralizado, NÃO chapado) ───────────
function Slide5() {
  return (
    <SlideShell bg="bg-[#FF5300]">
      {/* grão sutil pra não ficar chapado */}
      <div
        className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* faixa preta diagonal de marca no topo */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-black flex items-center justify-between px-8">
        <span className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300]">VS · CTA FINAL</span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/60">05 / 05</span>
      </div>

      {/* headline desalinhada pra esquerda, embaixo */}
      <div className="absolute left-8 right-8 bottom-32">
        <p className="font-mono text-[10px] tracking-[0.4em] text-black/60 uppercase mb-4">
          // próximo passo
        </p>
        <h2
          className="text-black font-black italic uppercase leading-[0.82] tracking-tight"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 96 }}
        >
          Para de
          <br />
          perder
          <br />
          dinheiro.
        </h2>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-[2px] w-12 bg-black" />
          <p className="font-mono text-xs tracking-[0.2em] text-black uppercase font-bold">
            vendasdesolucoes.com
          </p>
        </div>
      </div>

      {/* footer preto */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-black flex items-center justify-between px-8">
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/60">@VSSOLUCOES</span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300]">→ FALAR AGORA</span>
      </div>
    </SlideShell>
  );
}

const VARIANTS = [
  { id: "v4g4", label: "V1 — V4/G4 Brutalista" },
];

export default function MarketingProto() {
  const [variant, setVariant] = useState("v4g4");

  return (
    <div className="p-8 min-h-screen bg-[#050814]">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-8">
          <p className="font-mono text-xs tracking-[0.3em] text-[#FF5300] uppercase mb-2">
            // protótipo estático · não usa IA
          </p>
          <h1
            className="text-white font-black italic uppercase leading-none"
            style={{ fontFamily: "Poppins, sans-serif", fontSize: 56 }}
          >
            Carrossel VS · Padrão V4/G4
          </h1>
          <p className="text-white/60 mt-3 max-w-2xl">
            Tema fixo: <span className="text-white">"O custo invisível do vendedor humano"</span>.
            Julgue o visual — copy é placeholder. Se aprovar, replico esses 5 layouts nos templates da engine.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariant(v.id)}
              className={`px-4 py-2 font-mono text-xs tracking-[0.2em] uppercase border transition ${
                variant === v.id
                  ? "bg-[#FF5300] text-black border-[#FF5300]"
                  : "bg-transparent text-white/60 border-white/20 hover:border-white/50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* carrossel */}
        <div className="overflow-x-auto pb-8">
          <div className="flex gap-6">
            <Slide1 />
            <Slide2 />
            <Slide3 />
            <Slide4 />
            <Slide5 />
          </div>
        </div>

        <div className="mt-8 p-6 border border-white/10 bg-black/40">
          <p className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300] uppercase mb-3">
            // o que mudou em relação ao slide que você odiou
          </p>
          <ul className="text-white/70 text-sm space-y-2 list-disc list-inside">
            <li>Acabou o azul chapado centralizado — agora é preto + Cyber Orange (paleta 2026 real)</li>
            <li>Tipografia Poppins Black Italic, tamanhos 56-360px (era ~80px e fininha)</li>
            <li>Texto SEMPRE alinhado à esquerda/baixo — nunca centralizado em bloco</li>
            <li>Headlines de 3-5 palavras quebradas em linhas (era frase corrida)</li>
            <li>Marcadores editoriais ("// diagnóstico", "01 / 05") em mono, estilo terminal</li>
            <li>Slide de dado com número de 360px ocupando metade do canvas</li>
            <li>CTA final com faixa preta + diagonal de grão — não é mais "azul Microsoft"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}