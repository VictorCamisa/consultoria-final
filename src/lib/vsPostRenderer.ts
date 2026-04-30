export type PostFormat = "feed" | "story" | "square";

const DIMS: Record<PostFormat, [number, number]> = {
  feed: [1080, 1350],
  story: [1080, 1920],
  square: [1080, 1080],
};

const BG = "#050814";
const WHITE = "#FFFFFF";
const ORANGE = "#FF5300";

function font(size: number): string {
  return `italic 900 ${size}px 'Poppins', 'Arial Black', Impact, sans-serif`;
}

async function ensureFont(size: number): Promise<void> {
  try {
    await document.fonts.load(font(size));
  } catch {
    // fall through to system fonts silently
  }
}

function dotGrid(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const spacing = Math.round(W * 0.033);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let x = spacing; x < W; x += spacing) {
    for (let y = spacing; y < H; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function optimalFs(
  ctx: CanvasRenderingContext2D,
  words: string[],
  targetW: number,
  H: number,
): number {
  const probe = Math.round(H * 0.22);
  ctx.font = font(probe);
  const maxWord = Math.max(...words.map((w) => ctx.measureText(w).width));
  let fs = maxWord > 0 ? Math.round(probe * (targetW / maxWord)) : probe;
  return Math.max(Math.round(H * 0.10), Math.min(Math.round(H * 0.30), fs));
}

// Layout A — headline flush-left stacked, last word orange, line below
function layoutA(ctx: CanvasRenderingContext2D, words: string[], W: number, H: number): void {
  const MX = Math.round(W * 0.08);
  const availW = W - MX * 2;
  const fs = optimalFs(ctx, words, availW * 0.70, H);
  const lh = fs * 0.93;

  dotGrid(ctx, W, H * 0.60);

  ctx.textBaseline = "top";
  let y = Math.round(H * 0.17);
  words.forEach((word, i) => {
    ctx.font = font(fs);
    ctx.fillStyle = i === words.length - 1 ? ORANGE : WHITE;
    ctx.fillText(word, MX, y);
    y += lh;
  });

  ctx.fillStyle = ORANGE;
  ctx.fillRect(MX, y + Math.round(fs * 0.28), Math.round(availW * 0.38), Math.max(3, Math.round(H * 0.003)));
}

// Layout B — oversized first word, rest stacked smaller, or centered single word
function layoutB(ctx: CanvasRenderingContext2D, words: string[], W: number, H: number): void {
  const MX = Math.round(W * 0.08);
  const availW = W - MX * 2;

  dotGrid(ctx, W, H * 0.55);

  if (words.length === 1) {
    const fs = optimalFs(ctx, words, availW * 0.82, H);
    ctx.font = font(fs);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "middle";
    const tw = ctx.measureText(words[0]).width;
    ctx.fillText(words[0], (W - tw) / 2, H * 0.38);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(MX, Math.round(H * 0.58), Math.round(availW * 0.48), Math.max(4, Math.round(H * 0.004)));
  } else {
    const [first, ...rest] = words;
    const bigFs = optimalFs(ctx, [first], availW * 0.80, H);
    ctx.font = font(bigFs);
    ctx.fillStyle = WHITE;
    ctx.textBaseline = "top";
    ctx.fillText(first, MX, Math.round(H * 0.13));

    const smallFs = Math.round(bigFs * 0.48);
    let y = Math.round(H * 0.13) + bigFs * 0.98;
    rest.forEach((word, i) => {
      ctx.font = font(smallFs);
      ctx.fillStyle = i === rest.length - 1 ? ORANGE : WHITE;
      ctx.fillText(word, MX, y);
      y += smallFs * 0.95;
    });
    ctx.fillStyle = ORANGE;
    ctx.fillRect(MX, y + Math.round(smallFs * 0.3), Math.round(availW * 0.35), Math.max(3, Math.round(H * 0.003)));
  }
}

// Layout C — right-aligned block, orange thin rule at top, first word orange
function layoutC(ctx: CanvasRenderingContext2D, words: string[], W: number, H: number): void {
  const MX = Math.round(W * 0.08);
  const availW = W - MX * 2;
  const fs = optimalFs(ctx, words, availW * 0.68, H);
  const lh = fs * 0.93;

  dotGrid(ctx, W, H * 0.65);

  ctx.fillStyle = ORANGE;
  ctx.fillRect(MX, Math.round(H * 0.10), Math.round(availW * 0.25), Math.max(2, Math.round(H * 0.002)));

  ctx.textBaseline = "top";
  let y = Math.round(H * 0.16);
  words.forEach((word, i) => {
    ctx.font = font(fs);
    ctx.fillStyle = i === 0 ? ORANGE : WHITE;
    const tw = ctx.measureText(word).width;
    ctx.fillText(word, W - MX - tw, y);
    y += lh;
  });
}

const LAYOUTS = [layoutA, layoutB, layoutC];

export async function renderVSPost(
  headline: string,
  format: PostFormat = "feed",
  variant = 0,
): Promise<Blob> {
  const [W, H] = DIMS[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  await ensureFont(Math.round(H * 0.22));

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const words = headline.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    LAYOUTS[variant % LAYOUTS.length](ctx, words, W, H);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

export async function renderAndUpload(
  headline: string,
  format: PostFormat,
  platform: string,
  variant: number,
  supabase: any,
): Promise<string> {
  const blob = await renderVSPost(headline, format, variant);
  const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-${format}-v${variant}.png`;
  const { error } = await supabase.storage
    .from("vs-marketing")
    .upload(fileName, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
  return data.publicUrl;
}
