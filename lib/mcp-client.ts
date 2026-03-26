const MCP_URL = "https://rxfnmqd9va.ap-northeast-1.awsapprunner.com/mcp";

function parseSseData(text: string): unknown {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        // continue
      }
    }
  }
  return null;
}

export async function createMcpSession(): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-query-web", version: "1.0.0" },
      },
    }),
  });

  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("MCPセッションIDの取得に失敗しました");

  // initialized 通知を送信
  await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });

  return sessionId;
}

export async function callMcpTool(
  sessionId: string,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  const text = await res.text();
  const data = parseSseData(text) as {
    error?: { message: string };
    result?: { content?: Array<{ text?: string }> };
  } | null;

  if (data?.error) throw new Error(data.error.message);

  const content = data?.result?.content;
  if (Array.isArray(content)) {
    return content.map((c) => c.text ?? "").join("\n");
  }
  return JSON.stringify(data?.result ?? {});
}
