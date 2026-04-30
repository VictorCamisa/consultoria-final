import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function decodeBase64(base64: string): Uint8Array {
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 8 direções fotográficas distintas — sorteamos uma para forçar variação real
const DIRECOES = [
  "Retrato editorial em close, foco nos olhos, fundo escuro, luz lateral dura tipo NYT Magazine, expressão séria, grão de filme sutil",
  "Detalhe ambiental: mãos, objeto sobre mesa, papel, caneta, celular tocando — close extremo, profundidade de campo rasa",
  "Espaço corporativo vazio: sala, recepção, corredor, escritório à noite, luz natural diagonal, sem pessoas, sensação de abandono ou pausa",
  "Cena de bastidor: alguém de costas em frente a tela, monitor desfocado ao fundo, café sobre a mesa, luz quente de luminária",
  "Plano aberto urbano: prédio comercial visto de baixo ao entardecer, vidros refletindo céu, contraste alto",
  "Top-down (vista de cima): mesa de trabalho com objetos do nicho — agenda, cartão, relógio, celular — composição editorial",
  "Cena de rua: fachada de comércio do nicho (clínica, escritório, revenda) ao final do dia, luz dourada, sem pessoas em destaque",
  "Still life dramático: um único objeto simbólico do problema (um telefone fora do gancho, uma planilha impressa, uma chave) sob luz teatral em fundo escuro",
];

function buildPrompt(theme: string, visualSuggestion?: string): string {
  const direcao = DIRECOES[Math.floor(Math.random() * DIRECOES.length)];
  const sceneCue = visualSuggestion?.trim()
    ? `\nCENA ESPECÍFICA SOLICITADA (siga ao pé da letra): ${visualSuggestion.trim()}`
    : "";
  return [
    `Fotografia editorial brasileira para post B2B sobre: ${theme}.`,
    `Direção fotográfica desta imagem: ${direcao}.`,
    sceneCue,
    "",
    "REFERÊNCIAS estéticas: Bloomberg Businessweek, NYT Magazine, The Economist 1843, série Succession (HBO), Estado de S. Paulo edições especiais.",
    "Paleta: predominância escura (preto, carvão, azul-noite #1a2440, cinza chumbo) com UM ponto de cor quente (luz âmbar, lâmpada incandescente, reflexo dourado) ou luz fria pontual.",
    "Iluminação: cinematográfica, contrastada, sombras duras, rim light, sensação de hora azul ou interior à noite.",
    "Câmera: full-frame, 35mm ou 50mm, abertura f/1.8-f/2.8, profundidade de campo rasa, grão de filme sutil.",
    "Pessoas (se houver): brasileiras, idade 30-55, roupa profissional discreta, expressão pensativa ou cansada — JAMAIS sorriso de banco de imagens.",
    "Composição: assimétrica, terço inferior ou superior limpo (espaço para texto sobreposto), respeite a regra dos terços.",
    "",
    "PROIBIDO ABSOLUTAMENTE (qualquer ocorrência arruína a imagem):",
    "- Texto, palavras, letras, números, marcas d'água, logos, placas — NADA escrito.",
    "- Ilustração, vetor, design plano, 3D estilizado, cartoon, anime, infográfico, ícone, gráfico de barras.",
    "- Robôs, hologramas, cérebros digitais, redes neurais visuais, mãos saindo de telas — clichês de IA.",
    "- Sorriso forçado de stock photo, aperto de mão corporativo, equipe diversa posada olhando a câmera.",
    "- Cores saturadas tipo gradiente roxo-rosa, neon, RGB.",
    "DEVE parecer FOTO REAL tirada por fotojornalista. Realismo absoluto. Sem aspecto de IA.",
  ].filter(Boolean).join(" ");
}

async function generateWithNanoBanana(
  prompt: string,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Nano Banana 2 error:", res.status, text.slice(0, 600));
    return null;
  }

  const json = await res.json();
  const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
  if (!url) return null;
  // url é "data:image/png;base64,XXX"
  const base64 = url.includes(",") ? url.split(",", 2)[1] : url;
  return base64;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, platform = "Instagram", visual_suggestion } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const finalPrompt = buildPrompt(prompt, visual_suggestion);
    console.log("Image prompt:", finalPrompt.slice(0, 300));

    const base64 = await generateWithNanoBanana(finalPrompt, LOVABLE_API_KEY);

    if (!base64) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar imagem (Nano Banana 2)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = "image/png";
    const bytes = decodeBase64(base64);
    const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-bg.png`;

    const { error: uploadError } = await supabase.storage
      .from("vs-marketing")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ image_url: `data:${mimeType};base64,${base64}`, source: "nano-banana-2" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: pub } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
    return new Response(
      JSON.stringify({ image_url: pub.publicUrl, source: "nano-banana-2" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vs-generate-post-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
