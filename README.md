# @shoppingjaws/autocommit

ステージされた git diff から LLM を使って [Conventional Commits](https://www.conventionalcommits.org/) 形式のコミットメッセージを自動生成する CLI ツール。

## Features

- **マルチプロバイダー対応** — Anthropic (Claude)、OpenAI、Google (Gemini) を切り替え可能
- **Conventional Commits** — `feat`, `fix`, `refactor` 等の型を自動判定
- **多言語対応** — コミットメッセージの言語を設定で指定
- **スマートな差分フィルタリング** — lock ファイル等を自動除外、大きすぎる diff は自動トランケート
- **カスタムプロンプト** — テンプレート変数でプロンプトを自由にカスタマイズ
- **JSON5 設定** — コメント付きで設定ファイルを記述可能

## Installation

```bash
npm install -g @shoppingjaws/autocommit
```

## Quick Start

```bash
# 1. 設定ファイルを生成
autocommit init

# 2. API キーを環境変数にセット（プロバイダーに応じて）
export ANTHROPIC_API_KEY="sk-..."
# export OPENAI_API_KEY="sk-..."
# export GOOGLE_GENERATIVE_AI_API_KEY="..."

# 3. 変更をステージしてコミットメッセージを生成
git add .
autocommit
```

`autocommit` を実行すると、ステージ済みの差分から LLM がコミットメッセージを生成し、確認後にコミットします。

```
 src/cli.ts | 5 ++---
 1 file changed, 2 insertions(+), 3 deletions(-)

Generating commit message...

fix(cli): improve error handling for commit execution

Commit with this message? (y/N)
```

## Usage

```bash
# コミットメッセージを生成して確認後にコミット（デフォルト）
autocommit

# 確認をスキップして即コミット
autocommit run -y

# 設定ファイルを生成
autocommit init

# 既存の設定ファイルを上書き
autocommit init --force
```

## Configuration

設定ファイルは `~/.config/autocommit/config.json5` に保存されます（`$XDG_CONFIG_HOME` をサポート）。

`autocommit init` で以下のデフォルト設定が生成されます:

```json5
{
    // LLM provider: "anthropic" | "openai" | "google"
    "provider": "anthropic",

    // Model name
    "model": "claude-sonnet-4-20250514",

    // Environment variable name for the API key (uses provider default if omitted)
    // "apiKeyEnvVar": "ANTHROPIC_API_KEY",

    // Custom base URL (for proxies or self-hosted environments)
    // "baseURL": "https://my-proxy.example.com/v1",

    // Commit message language (ISO 639-1)
    "language": "en",

    // Maximum estimated token count for the entire diff (default: 20000)
    // "maxDiffTokens": 20000,

    // File patterns to exclude from diff (glob format)
    "ignorePatterns": [
        "*.lock",
        "package-lock.json",
        "bun.lock",
        "pnpm-lock.yaml"
    ],
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `"anthropic"` \| `"openai"` \| `"google"` | `"anthropic"` | LLM プロバイダー |
| `model` | `string` | `"claude-sonnet-4-20250514"` | モデル名 |
| `apiKeyEnvVar` | `string` | プロバイダーごとのデフォルト | API キーの環境変数名 |
| `baseURL` | `string` | — | カスタム API エンドポイント |
| `language` | `string` | `"en"` | コミットメッセージの言語 (ISO 639-1) |
| `ignorePatterns` | `string[]` | `["*.lock", ...]` | diff から除外するファイルパターン (glob) |
| `prompt` | `string` | 組み込みテンプレート | カスタムプロンプトテンプレート |
| `maxDiffTokens` | `number` | `20000` | diff の最大推定トークン数 |

### API Key Environment Variables

プロバイダーごとのデフォルト環境変数名:

| Provider | Default Env Var |
|----------|----------------|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |

`apiKeyEnvVar` で任意の環境変数名に変更できます。

### Custom Prompt

`prompt` フィールドでプロンプトテンプレートをカスタマイズできます。以下のプレースホルダーが使用可能:

| Placeholder | Description |
|-------------|-------------|
| `{{language}}` | 設定された言語 |
| `{{diff}}` | ステージ済みの diff |
| `{{excludedFiles}}` | 除外されたファイル一覧（カンマ区切り） |
| `{{#excludedFiles}}...{{/excludedFiles}}` | 除外ファイルがある場合のみ表示されるセクション |

## How It Works

1. `git diff --cached` でステージ済みの差分を取得
2. `ignorePatterns` に一致するファイルを除外
3. diff の推定トークン数が `maxDiffTokens` を超える場合、大きいファイルから順に除外
4. LLM に差分を送信し、Conventional Commits 形式のメッセージを生成
5. ユーザーに確認後、`git commit` を実行

## Development

```bash
# 依存関係インストール
bun install

# ビルド
bun run build

# 型チェック
bun run typecheck

# リント
bun run lint        # 自動修正あり
bun run lint:check  # チェックのみ

# フォーマット
bun run format        # 自動修正あり
bun run format:check  # チェックのみ

# テスト
bun run test
```
