# G空間情報センター 検索アプリ

自然言語でG空間情報センターのデータセットを検索できるチャット形式のWebアプリです。

## 概要

テキストで質問を入力すると、LLM が意図を解釈してG空間情報センターの MCP サーバーを呼び出し、関連するデータセットをリスト形式で回答します。

**主な機能**

- 自然言語によるデータセット検索（キーワード・地域・タグ）
- データセットの詳細情報取得
- チャット形式の会話履歴

**使用MCPサーバー**

- `https://rxfnmqd9va.ap-northeast-1.awsapprunner.com/mcp`（mcp-geospatial）

**技術スタック**

- [Next.js](https://nextjs.org/) 16 (App Router)
- TypeScript / Tailwind CSS
- Vercel（デプロイ先）

## セットアップ

### 必要なもの

- Node.js 18 以上
- 使用する LLM プロバイダーの API キー（下記参照）

### 手順

```bash
# リポジトリのクローン
git clone git@nouzui2007-github.com:nouzui2007/mcp-query.git
cd mcp-query

# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
```

`.env.local` を編集して使用するプロバイダーと API キーを設定します。

## LLM プロバイダーの選択

`LLM_PROVIDER` 環境変数でプロバイダーを切り替えられます。

### Anthropic（デフォルト）

使用モデル: `claude-sonnet-4-6`

1. [console.anthropic.com](https://console.anthropic.com) でアカウントを作成
2. **API Keys** ページでキーを発行
3. `.env.local` に設定:

```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Google（Gemini）

使用モデル: `gemini-2.0-flash`

1. [aistudio.google.com](https://aistudio.google.com) にアクセス（Googleアカウントで無料サインイン）
2. **Get API Key** → **Create API key** でキーを発行
3. `.env.local` に設定:

```
LLM_PROVIDER=google
GOOGLE_API_KEY=AIza...
```

## ローカル実行

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Vercel へのデプロイ

1. GitHub にプッシュ
2. [vercel.com](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に以下を設定:
   - `LLM_PROVIDER`（`anthropic` または `google`）
   - 対応する API キー
4. Deploy

## 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `MCP_URL` | MCPサーバーのURL | `https://rxfnmqd9va.ap-northeast-1.awsapprunner.com/mcp` |
| `LLM_PROVIDER` | 使用するLLMプロバイダー（`anthropic` / `google`） | `anthropic` |
| `ANTHROPIC_API_KEY` | Anthropic API キー（Anthropic使用時に必須） | — |
| `GOOGLE_API_KEY` | Google AI Studio API キー（Google使用時に必須） | — |
