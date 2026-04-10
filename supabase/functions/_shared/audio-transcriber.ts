/**
 * Shared audio transcription helper.
 * Downloads audio from Evolution API and transcribes via OpenAI Whisper.
 */

/**
 * Check if a message contains audio content.
 */
export function isAudioMessage(message: any): boolean {
  return !!(message?.audioMessage || message?.pttMessage);
}

/**
 * Download audio as base64 from Evolution API using getBase64FromMediaMessage.
 */
export async function downloadAudioBase64(
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
      console.error(`[audio] Download failed (${res.status}):`, await res.text());
      return null;
    }

    const result = await res.json();
    // Evolution API returns { base64: "..." } or { mediaUrl: "..." }
    return result?.base64 ?? null;
  } catch (e) {
    console.error("[audio] Download error:", e);
    return null;
  }
}

/**
 * Transcribe audio base64 using OpenAI Whisper API.
 */
export async function transcribeAudio(base64Audio: string, mimeType?: string): Promise<string | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.error("[audio] OPENAI_API_KEY not set");
    return null;
  }

  try {
    // Convert base64 to binary
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determine file extension from mime type
    const ext = mimeType?.includes("ogg") ? "ogg" 
      : mimeType?.includes("mp4") ? "m4a"
      : mimeType?.includes("mpeg") ? "mp3"
      : "ogg"; // WhatsApp default is ogg/opus

    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mimeType || "audio/ogg" }), `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      console.error(`[audio] Whisper failed (${res.status}):`, await res.text());
      return null;
    }

    const result = await res.json();
    return result?.text?.trim() || null;
  } catch (e) {
    console.error("[audio] Transcription error:", e);
    return null;
  }
}

/**
 * Full pipeline: detect audio → download → transcribe → return formatted content.
 * Returns null if not an audio message or if transcription fails.
 */
export async function processAudioMessage(
  message: any,
  messageData: any,
  evolutionBaseUrl: string,
  evolutionApiKey: string,
  instanceName: string,
): Promise<string | null> {
  if (!isAudioMessage(message)) return null;

  const audioMsg = message.audioMessage || message.pttMessage;
  const mimeType = audioMsg?.mimetype || "audio/ogg";

  console.log(`[audio] Downloading audio (${mimeType}) from instance ${instanceName}`);
  const base64 = await downloadAudioBase64(evolutionBaseUrl, evolutionApiKey, instanceName, messageData);
  
  if (!base64) {
    console.warn("[audio] Could not download audio, saving as placeholder");
    return "[🎤 Áudio recebido — falha no download]";
  }

  console.log(`[audio] Transcribing audio (${Math.round(base64.length / 1024)}KB)`);
  const transcription = await transcribeAudio(base64, mimeType);

  if (!transcription) {
    return "[🎤 Áudio recebido — falha na transcrição]";
  }

  return `[🎤 Áudio] ${transcription}`;
}
