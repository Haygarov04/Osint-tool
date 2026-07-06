import { config, hasXai } from "../config";

const XAI_BASE = "https://api.x.ai/v1";

export interface XaiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function xaiChat(
  messages: XaiMessage[],
  opts: GenerateOptions = {}
): Promise<string> {
  if (!hasXai()) {
    throw new Error("Липсва XAI_API_KEY. Добави го в .env.local");
  }

  const {
    model = "grok-4.3",
    temperature = 0.7,
    maxTokens = 800,
  } = opts;

  const res = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.xaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI грешка ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("xAI не върна съдържание.");
  }

  return content;
}
