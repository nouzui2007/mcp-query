import Anthropic from "@anthropic-ai/sdk";
import { callMcpTool, createMcpSession } from "@/lib/mcp-client";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MCP_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_datasets",
    description:
      "G空間情報センターのデータセットを検索します。キーワード、地域（バウンディングボックス）、タグで絞り込めます。",
    input_schema: {
      type: "object",
      properties: {
        q: {
          type: "string",
          description: "検索キーワード（例: 「東京 道路」「土地利用」）",
        },
        bbox: {
          type: "string",
          description:
            '空間範囲フィルタ "minx,miny,maxx,maxy" 形式（例: "139.0,35.0,140.0,36.0"）',
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "タグのリスト（AND検索）",
        },
        rows: {
          type: "integer",
          description: "取得件数（デフォルト10、最大100）",
        },
        start: {
          type: "integer",
          description: "ページネーション開始位置（デフォルト0）",
        },
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
        id: {
          type: "string",
          description: "データセットのUUIDまたはスラッグ名",
        },
      },
      required: ["id"],
    },
  },
];

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as {
      messages: Anthropic.MessageParam[];
    };

    const sessionId = await createMcpSession();
    let currentMessages: Anthropic.MessageParam[] = [...messages];

    // Claude がツール呼び出しを完了するまでループ
    for (let i = 0; i < 10; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `あなたはG空間情報センター（gspatial.jp）のデータ検索アシスタントです。
ユーザーの自然言語による質問に対して、適切なツールを使ってデータセットを検索・取得し、わかりやすく日本語で回答してください。

回答の際は以下の点を心がけてください：
- 見つかったデータセットはリスト形式で列挙する
- 各データセットの名前、説明、タグを簡潔に紹介する
- データセットが見つからない場合は、別のキーワードを提案する
- 地名が含まれる場合は、その地域の空間範囲（bbox）を使って絞り込むことを検討する`,
        messages: currentMessages,
        tools: MCP_TOOLS,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        return Response.json({ reply: text });
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            try {
              const result = await callMcpTool(
                sessionId,
                block.name,
                block.input as Record<string, unknown>
              );
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: result,
              };
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : "不明なエラー";
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: `エラー: ${message}`,
                is_error: true,
              };
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

    return Response.json({
      reply: "申し訳ありません、回答を生成できませんでした。",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("Chat API error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
