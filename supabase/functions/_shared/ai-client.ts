/**
 * Centralized AI client — uses OpenAI (gpt-4o-mini) for all tasks.
 * Exposes callClaude() with the same interface so all callers work unchanged.
 */

function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
             .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
             .replace(/[￾￿]/g, "");
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
 * Calls OpenAI (gpt-4o-mini) with the same interface previously used for Claude.
 * All callers (classify-prospect, suggest-reply, bluepaint, scrape-leads-worker) work unchanged.
 */
export async function callClaude(params: {
  system: string;
  messages: AIMessage[];
  tools?: AITool[];
  tool_choice?: { type: "tool"; name: string };
  max_tokens?: number;
}): Promise<{ content: any[]; text?: string; toolUse?: { name: string; input: any } }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const systemMessage = { role: "system" as const, content: sanitizeText(params.system) };
  const userMessages = sanitizeMessages(params.messages.filter(m => m.role !== "system"));
  const messages = [systemMessage, ...userMessages];

  const body: Record<string, unknown> = {
    model: "gpt-4o-mini",
    max_tokens: params.max_tokens ?? 4096,
    messages,
  };

  if (params.tools?.length) {
    body.tools = params.tools.map(t => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  if (params.tool_choice) {
    body.tool_choice = {
      type: "function",
      function: { name: params.tool_choice.name },
    };
  }

  const maxRetries = 4;
  let delay = 2000;
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const message = data.choices?.[0]?.message;

      if (message?.tool_calls?.length) {
        const toolCall = message.tool_calls[0];
        let input: any;
        try {
          input = JSON.parse(toolCall.function.arguments);
        } catch {
          input = {};
        }
        return {
          content: [{ type: "tool_use", name: toolCall.function.name, input }],
          toolUse: { name: toolCall.function.name, input },
        };
      }

      const text = message?.content ?? "";
      return {
        content: [{ type: "text", text }],
        text,
      };
    }

    const errText = await res.text();

    if (res.status === 401) throw new Error("AUTH_ERROR: Verifique a OPENAI_API_KEY");

    const retryable = [429, 500, 502, 503].includes(res.status);
    if (retryable && attempt < maxRetries) {
      console.warn(`[ai-client] OpenAI ${res.status}, retry ${attempt + 1}/${maxRetries} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    if (res.status === 429) throw new Error("RATE_LIMIT");
    lastError = `OpenAI error (${res.status}): ${errText.substring(0, 300)}`;
  }

  throw new Error(lastError || "OpenAI indisponível");
}

/** Alias — use this name in new code */
export const callOpenAI = callClaude;
