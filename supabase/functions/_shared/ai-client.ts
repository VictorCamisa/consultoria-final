/**
 * Centralized AI client factory.
 * Use Claude for scoring, classification, coaching.
 * GPT-4o-mini is kept only for the vendedor-chat roleplay simulator.
 */

/** Remove lone surrogates and other invalid Unicode that breaks JSON serialization */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
             .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
             .replace(/[\uFFFE\uFFFF]/g, "");
}

function sanitizeMessages(msgs: AIMessage[]): AIMessage[] {
  return msgs.map(m => ({ ...m, content: sanitizeText(m.content) }));
}
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AITool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Call Claude (Anthropic) — use for all ICP/scoring/coaching tasks.
 */
export async function callClaude(params: {
  system: string;
  messages: AIMessage[];
  tools?: AITool[];
  tool_choice?: { type: "tool"; name: string };
  max_tokens?: number;
}): Promise<{ content: any[]; text?: string; toolUse?: { name: string; input: any } }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const cleanMessages = sanitizeMessages(params.messages.filter(m => m.role !== "system"));
  const body: Record<string, unknown> = {
    model: "claude-haiku-4-5-20251001",
    max_tokens: params.max_tokens ?? 4096,
    system: sanitizeText(params.system),
    messages: cleanMessages,
  };

  if (params.tools?.length) {
    body.tools = params.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
  }

  if (params.tool_choice) {
    body.tool_choice = params.tool_choice;
  }

  const maxRetries = 3;
  let delay = 1500;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.content || [];

      const toolUseBlock = content.find((b: any) => b.type === "tool_use");
      if (toolUseBlock) {
        return { content, toolUse: { name: toolUseBlock.name, input: toolUseBlock.input } };
      }

      const textBlock = content.find((b: any) => b.type === "text");
      return { content, text: textBlock?.text ?? "" };
    }

    // Not OK — check if retryable
    const errText = await res.text();
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 401) throw new Error("AUTH_ERROR: Verifique a ANTHROPIC_API_KEY");

    // 529 = overloaded, retry with backoff
    if (res.status === 529 && attempt < maxRetries) {
      console.warn(`[ai-client] Anthropic 529 overloaded, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    lastError = `Anthropic error (${res.status}): ${errText.substring(0, 300)}`;
  }

  throw new Error(lastError || "Anthropic: max retries exceeded (529 overloaded)");
}
