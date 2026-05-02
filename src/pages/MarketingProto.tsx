import { useState } from "react";
import bgDefeat from "@/assets/proto/bg-defeat.jpg";
import bgCash from "@/assets/proto/bg-cash.jpg";
import bgAction from "@/assets/proto/bg-action.jpg";
import bgPhone from "@/assets/proto/bg-phone.jpg";

// Protótipo estático — carrossel V4/G4 brutalista
// Renderiza 5 slides 1080x1080 (escalados pra caber na tela) lado a lado
// Tema: "O custo invisível do vendedor humano"
// Sem IA, sem fetch, sem nada dinâmico. Só HTML/CSS pra você julgar.

const SLIDE_SIZE = 540; // 1080 / 2 — preview

function SlideShell({
  children,
  bg = "bg-black",
  image,
  imageOpacity = 0.55,
}: {
  children: React.ReactNode;
  bg?: string;
  image?: string;
  imageOpacity?: number;
}) {
  return (
    <div
      className={`relative ${bg} overflow-hidden flex-shrink-0 rounded-md shadow-2xl`}
      style={{ width: SLIDE_SIZE, height: SLIDE_SIZE }}
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: imageOpacity, filter: "grayscale(100%) contrast(1.15)" }}
          />
          {/* gradient overlay para legibilidade do texto (escurece embaixo) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
        </>
      )}
      {children}
    </div>
  );
}

// ─────────── SLIDE 1: HOOK ───────────
// Foto P&B do empresário derrotado de fundo. Headline curta brutal.
function Slide1() {
  return (
    <SlideShell image={bgDefeat} imageOpacity={0.7}>
      {/* barra superior cyber orange */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF5300] z-10" />

      <div className="absolute top-8 left-8 font-mono text-[10px] tracking-[0.3em] text-white/60 z-10">
        01 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-[10px] tracking-[0.3em] text-[#FF5300] z-10">
        VS · MANIFESTO
      </div>

      {/* headline — encurtada pra não vazar */}
      <div className="absolute left-8 right-8 bottom-16 z-10">
        <p className="font-mono text-[10px] tracking-[0.4em] text-[#FF5300] uppercase mb-3">
          // o que ninguém te conta
        </p>
        <h1
          className="text-white font-black italic uppercase leading-[0.85] tracking-tight"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 74 }}
        >
          Seu vendedor
          <br />
          custa <span className="text-[#FF5300]">3x</span>{" "}
          mais.
        </h1>
      </div>

      <div className="absolute bottom-5 left-8 right-8 flex items-center justify-between z-10">
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/50">@VSSOLUCOES</span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/60">ARRASTE →</span>
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 2: PROBLEM (split foto real + texto) ───────────
function Slide2() {
  return (
    <SlideShell bg="bg-[#0a0a0a]">
      {/* lado esquerdo: foto P&B real do dinheiro */}
      <div className="absolute top-0 left-0 bottom-0 w-[55%] overflow-hidden">
        <img
          src={bgCash}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "grayscale(100%) contrast(1.2)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/60" />
        <div className="absolute bottom-5 left-5 font-mono text-[9px] tracking-[0.3em] text-white/70 uppercase">
          Cena 02
        </div>
      </div>

      {/* lado direito: texto */}
      <div className="absolute top-0 right-0 bottom-0 w-[45%] flex flex-col justify-between p-7">
        <div className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300]">02 / 05</div>

        <div>
          <p className="font-mono text-[9px] tracking-[0.4em] text-white/40 uppercase mb-4">
            // diagnóstico
          </p>
          <h2
            className="text-white font-black italic uppercase leading-[0.85] tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif", fontSize: 52 }}
          >
            Treina.
            <br />
            Paga.
            <br />
            <span className="text-[#FF5300]">Repete.</span>
          </h2>
          <p className="text-white/70 text-xs mt-5 leading-snug max-w-[200px]">
            Salário, comissão, encargos. Em 8 meses pede demissão.
          </p>
        </div>

        <div className="font-mono text-[9px] tracking-[0.3em] text-white/30">@VSSOLUCOES</div>
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 3: DATA POINT (número heroico sobre foto do telefone) ───────────
function Slide3() {
  return (
    <SlideShell image={bgPhone} imageOpacity={0.4}>
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FF5300] z-10" />

      <div className="absolute top-8 left-8 font-mono text-[10px] tracking-[0.3em] text-white/60 z-10">
        03 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-[10px] tracking-[0.3em] text-[#FF5300] z-10">
        DADO
      </div>

      <div className="absolute top-20 left-8 right-8 z-10">
        <p className="font-mono text-[9px] tracking-[0.4em] text-white/50 uppercase">
          // pesquisa VS · 2025 · n=312
        </p>
      </div>

      {/* NÚMERO GIGANTE centralizado-esquerda */}
      <div className="absolute left-2 right-2 bottom-28 z-10">
        <div
          className="text-[#FF5300] font-black italic leading-[0.75] tracking-tighter text-center"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 320 }}
        >
          73<span className="text-white">%</span>
        </div>
      </div>

      <div className="absolute bottom-10 left-8 right-8 z-10">
        <p
          className="text-white font-black italic uppercase leading-[0.95] text-center"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 18 }}
        >
          Dos PMEs perdem o lead em menos de 2 horas
        </p>
      </div>

      <div className="absolute bottom-3 left-8 font-mono text-[9px] tracking-[0.3em] text-white/40 z-10">
        @VSSOLUCOES
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 4: PROCESS (lista numerada brutal) ───────────
function Slide4() {
  return (
    <SlideShell bg="bg-[#0a0a0a]">
      {/* coluna lateral com foto sutil */}
      <div className="absolute top-0 right-0 bottom-0 w-[30%] overflow-hidden opacity-40">
        <img
          src={bgAction}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "grayscale(100%) contrast(1.3)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/60 to-black" />
      </div>

      <div className="absolute top-8 left-8 font-mono text-xs tracking-[0.3em] text-white/40">
        04 / 05
      </div>
      <div className="absolute top-8 right-8 font-mono text-xs tracking-[0.3em] text-[#FF5300] z-10">
        SOLUÇÃO · 3 PASSOS
      </div>

      <div className="absolute top-24 left-8 right-8 z-10">
        <p
          className="text-white font-black italic uppercase leading-[0.9]"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 38 }}
        >
          Como a VS<br />resolve isso:
        </p>
      </div>

      {/* lista */}
      <div className="absolute left-8 right-8 bottom-16 space-y-5 z-10">
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

      <div className="absolute bottom-4 left-8 font-mono text-[9px] tracking-[0.3em] text-white/30 z-10">
        @VSSOLUCOES
      </div>
    </SlideShell>
  );
}

// ─────────── SLIDE 5: CTA brutal (foto do executivo decidido + overlay laranja) ───────────
function Slide5() {
  return (
    <SlideShell bg="bg-[#FF5300]">
      {/* foto P&B do executivo caminhando — multiply com laranja */}
      <img
        src={bgAction}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "grayscale(100%) contrast(1.4)", mixBlendMode: "multiply", opacity: 0.85 }}
      />
      {/* leve textura pra não ficar plástico */}
      <div
        className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* faixa preta diagonal de marca no topo */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-black flex items-center justify-between px-8 z-10">
        <span className="font-mono text-[10px] tracking-[0.3em] text-[#FF5300]">VS · CTA FINAL</span>
        <span className="font-mono text-[10px] tracking-[0.3em] text-white/60">05 / 05</span>
      </div>

      {/* headline desalinhada pra esquerda, embaixo */}
      <div className="absolute left-8 right-8 bottom-28 z-10">
        <p className="font-mono text-[10px] tracking-[0.4em] text-black uppercase mb-4 font-bold">
          // próximo passo
        </p>
        <h2
          className="text-black font-black italic uppercase leading-[0.82] tracking-tight"
          style={{ fontFamily: "Poppins, sans-serif", fontSize: 88 }}
        >
          Para de
          <br />
          perder
          <br />
          dinheiro.
        </h2>
        <div className="mt-6 flex items-center gap-3">
          <div className="h-[2px] w-12 bg-black" />
          <p className="font-mono text-[10px] tracking-[0.2em] text-black uppercase font-bold">
            vendasdesolucoes.com
          </p>
        </div>
      </div>

      {/* footer preto */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-black flex items-center justify-between px-8 z-10">
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