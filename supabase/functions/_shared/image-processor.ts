/**
 * Shared image processing helper.
 * Downloads images from Evolution API and describes them via OpenAI Vision.
 */

/**
 * Check if a message contains an image.
 */
export function isImageMessage(message: any): boolean {
  return !!(message?.imageMessage);
}

/**
 * Check if a message contains a video.
 */
export function isVideoMessage(message: any): boolean {
  return !!(message?.videoMessage);
}

/**
 * Check if a message contains a document/file.
 */
export function isDocumentMessage(message: any): boolean {
  return !!(message?.documentMessage);
}

/**
 * Check if a message contains a sticker.
 */
export function isStickerMessage(message: any): boolean {
  return !!(message?.stickerMessage);
}

/**
 * Get media type label for unsupported types.
 */
export function getMediaTypeLabel(message: any): string | null {
  if (isVideoMessage(message)) return "vídeo";
  if (isDocumentMessage(message)) return "documento";
  if (isStickerMessage(message)) return "sticker";
  if (message?.contactMessage) return "contato";
  if (message?.locationMessage) return "localização";
  return null;
}

/**
 * Download image as base64 from Evolution API using getBase64FromMediaMessage.
 */
export async function downloadImageBase64(
  evolutionBaseUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  messageData: any,
): Promise<string | null> {
  try {
    const url = `${evolutionBaseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: evolutionApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: messageData }),
    });

    if (!res.ok) {
      console.error(`[image] Download failed (${res.status}):`, await res.text());
      return null;
    }

    const result = await res.json();
    return result?.base64 ?? null;
  } catch (e) {
    console.error("[image] Download error:", e);
    return null;
  }
}

/**
 * Describe an image using OpenAI Vision API.
 */
export async function describeImage(base64Image: string, mimeType?: string): Promise<string | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.error("[image] OPENAI_API_KEY not set");
    return null;
  }

  try {
    const mime = mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64Image}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Descreva esta imagem de forma objetiva e concisa em português brasileiro, em no máximo 2 frases. Se houver texto na imagem, transcreva-o entre aspas.",
              },
              {
                type: "image_url",
                image_url: { url: dataUrl, detail: "low" },
              },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error(`[image] Vision failed (${res.status}):`, await res.text());
      return null;
    }

    const result = await res.json();
    return result?.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("[image] Vision error:", e);
    return null;
  }
}

/**
 * Full pipeline: detect image → download → describe → return formatted content.
 */
export async function processImageMessage(
  message: any,
  messageData: any,
  evolutionBaseUrl: string,
  evolutionApiKey: string,
  instanceName: string,
): Promise<string | null> {
  if (!isImageMessage(message)) return null;

  const imageMsg = message.imageMessage;
  const mimeType = imageMsg?.mimetype || "image/jpeg";
  const caption = imageMsg?.caption || "";

  console.log(`[image] Downloading image (${mimeType}) from instance ${instanceName}`);
  const base64 = await downloadImageBase64(evolutionBaseUrl, evolutionApiKey, instanceName, messageData);

  if (!base64) {
    console.warn("[image] Could not download image");
    return caption
      ? `[📷 Imagem — falha no download] ${caption}`
      : "[📷 Imagem recebida — falha no download]";
  }

  console.log(`[image] Describing image (${Math.round(base64.length / 1024)}KB)`);
  const description = await describeImage(base64, mimeType);

  if (!description) {
    return caption
      ? `[📷 Imagem] ${caption}`
      : "[📷 Imagem recebida — descrição indisponível]";
  }

  if (caption) {
    return `[📷 Imagem: ${description}] Legenda: ${caption}`;
  }
  return `[📷 Imagem: ${description}]`;
}
