import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { callMcpTool, createMcpSession } from "./mcp-client";

export type Message = { role: "user" | "assistant"; content: string };

export type McpCall = {
  tool: string;
  args: Record<string, unknown>;
  result: string;
};

export type ChatResult = {
  reply: string;
  mcpCalls: McpCall[];
};

const SYSTEM_PROMPT = `あなたはG空間情報センター（gspatial.jp）のデータ検索アシスタントです。
ユーザーの自然言語による質問に対して、適切なツールを使ってデータセットを検索・取得し、わかりやすく日本語で回答してください。

回答の際は以下の点を心がけてください：
- 見つかったデータセットはリスト形式で列挙する
- 各データセットの名前、説明、タグを簡潔に紹介する
- データセットが見つからない場合は、別のキーワードを提案する
- 地名が含まれる場合は、その地域の空間範囲（bbox）を使って絞り込むことを検討する`;

// ---- Anthropic -------------------------------------------------------

const ANTHROPIC_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_datasets",
    description:
      "G空間情報センターのデータセットを検索します。キーワード、地域（バウンディングボックス）、タグで絞り込めます。",
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "検索キーワード" },
        bbox: {
          type: "string",
          description: '空間範囲フィルタ "minx,miny,maxx,maxy" 形式（例: "139.0,35.0,140.0,36.0"）',
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "タグのリスト（AND検索）",
        },
        rows: { type: "integer", description: "取得件数（デフォルト10）" },
        start: { type: "integer", description: "ページネーション開始位置（デフォルト0）" },
      },
    },
  },
  {
    name: "get_dataset",
    description:
      "G空間情報センターのデータセットの詳細情報（説明、ライセンス、リソース一覧など）を取得します。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "データセットのUUIDまたはスラッグ名" },
      },
      required: ["id"],
    },
  },
];

async function chatWithAnthropic(messages: Message[], sessionId: string): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const mcpCalls: McpCall[] = [];

  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: currentMessages,
      tools: ANTHROPIC_TOOLS,
    });

    if (response.stop_reason === "end_turn") {
      const reply = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return { reply, mcpCalls };
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
      );
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const args = block.input as Record<string, unknown>;
          try {
            const result = await callMcpTool(sessionId, block.name, args);
            mcpCalls.push({ tool: block.name, args, result });
            return { type: "tool_result" as const, tool_use_id: block.id, content: result };
          } catch (err: unknown) {
            const errMsg = `エラー: ${err instanceof Error ? err.message : "不明なエラー"}`;
            mcpCalls.push({ tool: block.name, args, result: errMsg });
            return { type: "tool_result" as const, tool_use_id: block.id, content: errMsg, is_error: true };
          }
        })
      );
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    } else {
      break;
    }
  }

  return { reply: "申し訳ありません、回答を生成できませんでした。", mcpCalls };
}

// ---- Google ----------------------------------------------------------

const GOOGLE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_datasets",
        description:
          "G空間情報センターのデータセットを検索します。キーワード、地域（バウンディングボックス）、タグで絞り込めます。",
        parameters: {
          type: "OBJECT",
          properties: {
            q: { type: "STRING", description: "検索キーワード" },
            bbox: {
              type: "STRING",
              description: '空間範囲フィルタ "minx,miny,maxx,maxy" 形式（例: "139.0,35.0,140.0,36.0"）',
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "タグのリスト（AND検索）",
            },
            rows: { type: "INTEGER", description: "取得件数（デフォルト10）" },
            start: { type: "INTEGER", description: "ページネーション開始位置（デフォルト0）" },
          },
        },
      },
      {
        name: "get_dataset",
        description:
          "G空間情報センターのデータセットの詳細情報（説明、ライセンス、リソース一覧など）を取得します。",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "データセットのUUIDまたはスラッグ名" },
          },
          required: ["id"],
        },
      },
    ],
  },
];

async function chatWithGoogle(messages: Message[], sessionId: string): Promise<ChatResult> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: GOOGLE_TOOLS as any,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history });
  const mcpCalls: McpCall[] = [];

  let response = await chat.sendMessage(messages[messages.length - 1].content);

  for (let i = 0; i < 10; i++) {
    const functionCalls = response.response.functionCalls();
    if (!functionCalls || functionCalls.length === 0) break;

    const functionResults = await Promise.all(
      functionCalls.map(async (call) => {
        const args = call.args as Record<string, unknown>;
        try {
          const result = await callMcpTool(sessionId, call.name, args);
          mcpCalls.push({ tool: call.name, args, result });
          return { functionResponse: { name: call.name, response: { result } } };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "不明なエラー";
          mcpCalls.push({ tool: call.name, args, result: `エラー: ${errMsg}` });
          return { functionResponse: { name: call.name, response: { error: errMsg } } };
        }
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response = await chat.sendMessage(functionResults as any);
  }

  return { reply: response.response.text(), mcpCalls };
}

// ---- Entry point -----------------------------------------------------

export async function chat(messages: Message[]): Promise<ChatResult> {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const sessionId = await createMcpSession();

  if (provider === "google") {
    return chatWithGoogle(messages, sessionId);
  }
  return chatWithAnthropic(messages, sessionId);
}
