/**
 * Centralized AI client factory.
 * Use Claude for scoring, classification, coaching.
 * GPT-4o-mini is kept only for the vendedor-chat roleplay simulator.
 */

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

  const body: Record<string, unknown> = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: params.max_tokens ?? 4096,
    system: params.system,
    messages: params.messages.filter(m => m.role !== "system"),
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) throw new Error("RATE_LIMIT");
    if (res.status === 401) throw new Error("AUTH_ERROR: Verifique a ANTHROPIC_API_KEY");
    throw new Error(`Anthropic error (${res.status}): ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  const content = data.content || [];

  // Extract tool_use block
  const toolUseBlock = content.find((b: any) => b.type === "tool_use");
  if (toolUseBlock) {
    return { content, toolUse: { name: toolUseBlock.name, input: toolUseBlock.input } };
  }

  // Extract plain text
  const textBlock = content.find((b: any) => b.type === "text");
  return { content, text: textBlock?.text ?? "" };
}
