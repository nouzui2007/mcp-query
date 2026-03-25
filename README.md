# G空間情報センター 検索アプリ

自然言語でG空間情報センターのデータセットを検索できるチャット形式のWebアプリです。

## 概要

テキストで質問を入力すると、Claude AI が意図を解釈してG空間情報センターの MCP サーバーを呼び出し、関連するデータセットをリスト形式で回答します。

**主な機能**

- 自然言語によるデータセット検索（キーワード・地域・タグ）
- データセットの詳細情報取得
- チャット形式の会話履歴

**使用MCPサーバー**

- `https://6b2mphec6a.ap-northeast-1.awsapprunner.com/mcp`（mcp-geospatial v1.26.0）

**技術スタック**

- [Next.js](https://nextjs.org/) 16 (App Router)
- [Claude API](https://docs.anthropic.com/) (claude-sonnet-4-6, tool_use)
- TypeScript / Tailwind CSS
- Vercel（デプロイ先）

## セットアップ

### 必要なもの

- Node.js 18 以上
- Anthropic API キー（[console.anthropic.com](https://console.anthropic.com) で取得）

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

`.env.local` を編集して API キーを設定します。

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## ローカル実行

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Vercel へのデプロイ

1. GitHub にプッシュ
2. [vercel.com](https://vercel.com) でリポジトリをインポート
3. **Environment Variables** に `ANTHROPIC_API_KEY` を設定
4. Deploy

## 環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API キー | ✅ |
