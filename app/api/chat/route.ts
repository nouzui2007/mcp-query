import { chat } from "@/lib/llm";
import type { Message } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as { messages: Message[] };
    const { reply, mcpCalls } = await chat(messages);
    return Response.json({ reply, mcpCalls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("Chat API error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
