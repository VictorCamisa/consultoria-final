// Imagery Engine — Tratamento Canvas no client.
// Aplica: vinheta, leve desaturação, grão sutil, levantar pretos pra dar look editorial.
// Recebe URL de imagem PNG raw → devolve dataURL PNG tratado.

export async function treatImage(rawUrl: string): Promise<string> {
  const img = await loadImage(rawUrl);
  const w = img.naturalWidth || 1080;
  const h = img.naturalHeight || 1080;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível");

  ctx.drawImage(img, 0, 0, w, h);

  // 1. Leve desaturação + leve aumento de contraste via filter
  ctx.globalCompositeOperation = "source-over";
  // Aplica "filter" pintando outra vez
  ctx.save();
  (ctx as any).filter = "saturate(0.85) contrast(1.06) brightness(0.97)";
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();

  // 2. Vinheta radial (escurece bordas)
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(5,8,20,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 3. Grão sutil (ruído monocromático ~3% opacidade)
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = 256;
  noiseCanvas.height = 256;
  const nctx = noiseCanvas.getContext("2d")!;
  const idata = nctx.createImageData(256, 256);
  for (let i = 0; i < idata.data.length; i += 4) {
    const v = Math.random() * 255;
    idata.data[i] = v;
    idata.data[i + 1] = v;
    idata.data[i + 2] = v;
    idata.data[i + 3] = 255;
  }
  nctx.putImageData(idata, 0, 0);
  const pattern = ctx.createPattern(noiseCanvas, "repeat");
  if (pattern) {
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL("image/png");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const resp = await fetch(dataUrl);
  return await resp.blob();
}