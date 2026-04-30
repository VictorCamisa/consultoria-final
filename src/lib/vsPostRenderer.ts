export type PostFormat = "feed" | "story" | "square";

export interface PostRenderOptions {
  headline: string;
  tagline?: string;
  format?: PostFormat;
  variant?: number;
  logoUrl?: string;
  handle?: string;
  bgImageUrl?: string;
}

const DIMS: Record<PostFormat, [number, number]> = {
  feed: [1080, 1350],
  story: [1080, 1920],
  square: [1080, 1080],
};

const BG = "#050814";
const WHITE = "#FFFFFF";
const ORANGE = "#FF5300";
const WHITE_DIM = "rgba(255,255,255,0.18)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureFont(size: number): Promise<void> {
  try { await document.fonts.load(`italic 900 ${size}px 'Poppins'`); } catch { /* fallback */ }
  try { await document.fonts.load(`400 ${size}px 'Poppins'`); } catch { /* fallback */ }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function font(size: number, weight: 400 | 900 = 900, italic = true): string {
  const style = italic ? "italic" : "normal";
  return `${style} ${weight} ${size}px 'Poppins', 'Arial Black', sans-serif`;
}

function optimalFs(
  ctx: CanvasRenderingContext2D,
  words: string[],
  targetW: number,
  H: number,
  maxRatio = 0.28,
): number {
  const probe = Math.round(H * 0.22);
  ctx.font = font(probe);
  const maxWord = Math.max(...words.map((w) => ctx.measureText(w).width), 1);
  let fs = Math.round(probe * (targetW / maxWord));
  return Math.max(Math.round(H * 0.09), Math.min(Math.round(H * maxRatio), fs));
}

// Subtle dot-grid background (full canvas)
function drawDots(ctx: CanvasRenderingContext2D, W: number, H: number, opacity = 0.045): void {
  const spacing = Math.round(W * 0.033);
  ctx.fillStyle = `rgba(255,255,255,${opacity})`;
  for (let x = spacing; x < W; x += spacing) {
    for (let y = spacing; y < H; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draw logo image respecting aspect ratio, anchored to (x,y), max height maxH
function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  maxH: number,
): void {
  const ratio = img.naturalWidth / img.naturalHeight;
  const h = maxH;
  const w = Math.round(h * ratio);
  ctx.drawImage(img, x, y, w, h);
}

// Truncate text so it fits within maxW, adding ellipsis
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

// ─── Template A: EDITORIAL POSTER ────────────────────────────────────────────
// Logo top-left | orange accent corner top-right
// Dot grid background | Big headline flush-left stacked
// Orange rule | Tagline | Bottom bar with handle
async function templateA(
  ctx: CanvasRenderingContext2D,
  opts: Required<PostRenderOptions> & { logo: HTMLImageElement | null },
  W: number,
  H: number,
): Promise<void> {
  const MX = Math.round(W * 0.08);
  const MY = Math.round(H * 0.07);
  const availW = W - MX * 2;

  // 1. Dot grid
  drawDots(ctx, W, H, 0.04);

  // 2. Logo — top-left
  const logoH = Math.round(H * 0.055);
  if (opts.logo) drawLogo(ctx, opts.logo, MX, MY, logoH);

  // 3. Orange accent square — top-right corner
  const sqSize = Math.round(W * 0.04);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(W - MX - sqSize, MY + Math.round(logoH * 0.1), sqSize, sqSize);

  // 4. Headline — starts at ~22% from top
  const words = opts.headline.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const fs = optimalFs(ctx, words, availW * 0.78, H, 0.30);
  const lh = fs * 0.88;
  let hy = Math.round(H * 0.20);

  ctx.textBaseline = "top";
  words.forEach((word, i) => {
    ctx.font = font(fs);
    // Last word gets orange only when there are 2+ words (avoid orphan prepositions)
    const isLast = i === words.length - 1;
    ctx.fillStyle = (isLast && words.length >= 2) ? ORANGE : WHITE;
    ctx.fillText(word, MX, hy);
    hy += lh;
  });

  // 5. Orange accent rule below headline
  const ruleY = hy + Math.round(fs * 0.22);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(MX, ruleY, Math.round(availW * 0.35), Math.max(3, Math.round(H * 0.003)));

  // 6. Tagline — below rule, smaller, regular weight
  if (opts.tagline) {
    const tagFs = Math.round(fs * 0.22);
    ctx.font = font(tagFs, 400, false);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textBaseline = "top";
    const tagY = ruleY + Math.round(tagFs * 2.2);

    // wrap to max 2 lines
    const tagWords = opts.tagline.split(" ");
    let line = "";
    let lineY = tagY;
    const maxLines = 2;
    let lineCount = 0;
    for (const w of tagWords) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > availW * 0.80) {
        if (lineCount < maxLines) {
          const rendered = lineCount === maxLines - 1 ? truncate(ctx, test, availW * 0.80) : line;
          ctx.fillText(rendered, MX, lineY);
          lineY += Math.round(tagFs * 1.55);
          lineCount++;
        }
        line = w;
      } else {
        line = test;
      }
    }
    if (line && lineCount < maxLines) ctx.fillText(line, MX, lineY);
  }

  // 7. Bottom bar — thin divider + handle
  const barY = H - Math.round(H * 0.085);
  ctx.fillStyle = WHITE_DIM;
  ctx.fillRect(MX, barY, availW, 1);

  const handleFs = Math.round(H * 0.022);
  ctx.font = font(handleFs, 400, false);
  ctx.textBaseline = "middle";
  const midBar = barY + Math.round(H * 0.042);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(opts.handle, MX, midBar);

  // re-draw logo small on bottom-right if available
  if (opts.logo) {
    const logoSmH = Math.round(H * 0.032);
    const logoSmW = Math.round(logoSmH * (opts.logo.naturalWidth / opts.logo.naturalHeight));
    drawLogo(ctx, opts.logo, W - MX - logoSmW, midBar - logoSmH / 2, logoSmH);
  }
}

// ─── Template B: IMPACT BAR ───────────────────────────────────────────────────
// Vertical orange bar on left | Headline to the right, massive
// Logo bottom-left | Handle bottom-right
async function templateB(
  ctx: CanvasRenderingContext2D,
  opts: Required<PostRenderOptions> & { logo: HTMLImageElement | null },
  W: number,
  H: number,
): Promise<void> {
  const MX = Math.round(W * 0.08);
  const MY = Math.round(H * 0.07);
  const availW = W - MX * 2;

  // Dots — lighter
  drawDots(ctx, W, H, 0.035);

  // Vertical orange accent bar — left side
  const barW = Math.round(W * 0.012);
  const barTop = Math.round(H * 0.20);
  const barBot = Math.round(H * 0.72);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(MX, barTop, barW, barBot - barTop);

  // Headline — right of bar, stacked
  const words = opts.headline.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const headMX = MX + barW + Math.round(W * 0.04);
  const headAvailW = W - headMX - Math.round(W * 0.06);
  const fs = optimalFs(ctx, words, headAvailW * 0.82, H, 0.28);
  const lh = fs * 0.92;
  let hy = Math.round(H * 0.22);

  ctx.textBaseline = "top";
  words.forEach((word, i) => {
    ctx.font = font(fs);
    ctx.fillStyle = i === 0 ? WHITE : (i === words.length - 1 ? ORANGE : WHITE);
    ctx.fillText(word, headMX, hy);
    hy += lh;
  });

  // Orange small rule after headline
  const ruleY = hy + Math.round(fs * 0.18);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(headMX, ruleY, Math.round(headAvailW * 0.30), Math.max(3, Math.round(H * 0.003)));

  // Tagline
  if (opts.tagline) {
    const tagFs = Math.round(fs * 0.21);
    ctx.font = font(tagFs, 400, false);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.textBaseline = "top";
    const t = truncate(ctx, opts.tagline, headAvailW * 0.78);
    ctx.fillText(t, headMX, ruleY + Math.round(tagFs * 2.4));
  }

  // Bottom: logo left, handle right
  const botY = H - MY;
  if (opts.logo) {
    const lh2 = Math.round(H * 0.038);
    drawLogo(ctx, opts.logo, MX, botY - lh2, lh2);
  }
  const hFs = Math.round(H * 0.022);
  ctx.font = font(hFs, 400, false);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.textBaseline = "bottom";
  const hw = ctx.measureText(opts.handle).width;
  ctx.fillText(opts.handle, W - MX - hw, botY);
}

// ─── Template C: MAGAZINE FRAME ──────────────────────────────────────────────
// L-shaped orange corner accents | Headline centered | Logo bottom-center
async function templateC(
  ctx: CanvasRenderingContext2D,
  opts: Required<PostRenderOptions> & { logo: HTMLImageElement | null },
  W: number,
  H: number,
): Promise<void> {
  const MX = Math.round(W * 0.08);
  const MY = Math.round(H * 0.07);
  const availW = W - MX * 2;
  const FRAME_IN = Math.round(W * 0.06);
  const STROKE = Math.max(3, Math.round(W * 0.004));
  const ARM = Math.round(W * 0.12); // length of L-arm

  // Dots
  drawDots(ctx, W, H, 0.04);

  // L-shaped corner accents in orange
  const cx = [FRAME_IN, W - FRAME_IN]; // left, right
  const cy = [FRAME_IN, H - FRAME_IN]; // top, bottom
  ctx.fillStyle = ORANGE;
  // top-left
  ctx.fillRect(cx[0], cy[0], ARM, STROKE);
  ctx.fillRect(cx[0], cy[0], STROKE, ARM);
  // top-right
  ctx.fillRect(cx[1] - ARM, cy[0], ARM, STROKE);
  ctx.fillRect(cx[1] - STROKE, cy[0], STROKE, ARM);
  // bottom-left
  ctx.fillRect(cx[0], cy[1] - STROKE, ARM, STROKE);
  ctx.fillRect(cx[0], cy[1] - ARM, STROKE, ARM);
  // bottom-right
  ctx.fillRect(cx[1] - ARM, cy[1] - STROKE, ARM, STROKE);
  ctx.fillRect(cx[1] - STROKE, cy[1] - ARM, STROKE, ARM);

  // Logo — top-center
  const logoH = Math.round(H * 0.052);
  if (opts.logo) {
    const logoW = Math.round(logoH * (opts.logo.naturalWidth / opts.logo.naturalHeight));
    drawLogo(ctx, opts.logo, (W - logoW) / 2, MY + FRAME_IN * 0.5, logoH);
  }

  // Headline — center-aligned, stacked
  const words = opts.headline.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const fs = optimalFs(ctx, words, availW * 0.68, H, 0.26);
  const lh = fs * 0.93;
  const totalH = lh * words.length;
  let hy = (H - totalH) / 2 - Math.round(H * 0.04);

  ctx.textBaseline = "top";
  words.forEach((word, i) => {
    ctx.font = font(fs);
    ctx.fillStyle = i === words.length - 1 ? ORANGE : WHITE;
    const tw = ctx.measureText(word).width;
    ctx.fillText(word, (W - tw) / 2, hy);
    hy += lh;
  });

  // Orange thin rule below headline
  const ruleY = hy + Math.round(fs * 0.18);
  const ruleW = Math.round(availW * 0.28);
  ctx.fillStyle = ORANGE;
  ctx.fillRect((W - ruleW) / 2, ruleY, ruleW, Math.max(2, Math.round(H * 0.002)));

  // Tagline below rule, centered
  if (opts.tagline) {
    const tagFs = Math.round(fs * 0.20);
    ctx.font = font(tagFs, 400, false);
    ctx.fillStyle = "rgba(255,255,255,0.60)";
    ctx.textBaseline = "top";
    const t = truncate(ctx, opts.tagline, availW * 0.70);
    const tw = ctx.measureText(t).width;
    ctx.fillText(t, (W - tw) / 2, ruleY + Math.round(tagFs * 2.2));
  }

  // Handle centered near bottom
  const hFs = Math.round(H * 0.022);
  ctx.font = font(hFs, 400, false);
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  ctx.textBaseline = "bottom";
  const hw = ctx.measureText(opts.handle).width;
  ctx.fillText(opts.handle, (W - hw) / 2, H - MY - FRAME_IN * 0.2);
}

// ─── Public API ───────────────────────────────────────────────────────────────

const TEMPLATES = [templateA, templateB, templateC];

export async function renderVSPost(options: PostRenderOptions): Promise<Blob> {
  const {
    headline,
    tagline = "",
    format = "feed",
    variant = 0,
    logoUrl,
    handle = "@vs",
    bgImageUrl,
  } = options;

  const [W, H] = DIMS[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  await ensureFont(Math.round(H * 0.22));

  // Background Base
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Background Image
  if (bgImageUrl) {
    try {
      const bgImage = await loadImage(bgImageUrl);
      const imgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
      const canvasRatio = W / H;
      let sWidth = bgImage.naturalWidth;
      let sHeight = bgImage.naturalHeight;
      let sx = 0;
      let sy = 0;

      if (imgRatio > canvasRatio) {
        sWidth = bgImage.naturalHeight * canvasRatio;
        sx = (bgImage.naturalWidth - sWidth) / 2;
      } else {
        sHeight = bgImage.naturalWidth / canvasRatio;
        sy = (bgImage.naturalHeight - sHeight) / 2;
      }
      
      ctx.drawImage(bgImage, sx, sy, sWidth, sHeight, 0, 0, W, H);
      
      // Apply dark overlay for text legibility
      ctx.fillStyle = "rgba(5, 8, 20, 0.65)";
      ctx.fillRect(0, 0, W, H);
    } catch (e) {
      console.warn("Failed to load bgImageUrl", e);
    }
  }

  // Load logo (non-fatal if missing)
  let logo: HTMLImageElement | null = null;
  if (logoUrl) {
    try { logo = await loadImage(logoUrl); } catch { logo = null; }
  }

  const filled: Required<PostRenderOptions> & { logo: HTMLImageElement | null } = {
    headline,
    tagline,
    format,
    variant,
    logoUrl: logoUrl ?? "",
    handle,
    bgImageUrl: bgImageUrl ?? "",
    logo,
  };

  await TEMPLATES[variant % TEMPLATES.length](ctx, filled, W, H);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
    );
  });
}

export async function renderAndUpload(
  options: PostRenderOptions & { platform: string; supabase: any },
): Promise<string> {
  const { platform, supabase, ...renderOpts } = options;
  const format = renderOpts.format ?? "feed";
  const variant = renderOpts.variant ?? 0;

  const blob = await renderVSPost(renderOpts);
  const fileName = `posts/${Date.now()}-${platform.toLowerCase()}-${format}-v${variant}.png`;
  const { error } = await supabase.storage
    .from("vs-marketing")
    .upload(fileName, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("vs-marketing").getPublicUrl(fileName);
  return data.publicUrl;
}
