# autocommit - Spec

## 概要

gitのステージされたファイル差分（`git diff --cached`）を入力として、LLMを用いて適切なコミットメッセージを生成するCLIツール。

## 動機

コミットメッセージの作成は手間がかかり、品質にばらつきが出やすい。差分の内容からLLMが自動でメッセージを生成することで、一貫性のある高品質なコミットメッセージを効率的に作成したい。

## 基本フロー

1. ユーザーが `autocommit` コマンドを実行
2. `git diff --cached` でステージされた差分を取得
3. 設定の `ignorePatterns` に該当するファイルの差分を除外
4. 差分をLLM APIに送信し、Conventional Commits形式のコミットメッセージを生成
5. 生成されたメッセージを表示し、ユーザーに確認を求める
   - `--yes` / `-y` オプション指定時は確認をスキップ
6. ユーザーが承認したら `git commit -m "<生成メッセージ>"` を実行

## LLMプロバイダー

AI SDK（Vercel AI SDK）を使用し、主要3社のモデルに対応する。

### 対応プロバイダー

| プロバイダー | モデル例 | APIキー環境変数 |
|---|---|---|
| Anthropic | claude-sonnet-4-20250514 | `ANTHROPIC_API_KEY` |
| OpenAI | gpt-4o | `OPENAI_API_KEY` |
| Google | gemini-2.0-flash | `GOOGLE_GENERATIVE_AI_API_KEY` |

### モデル指定

設定ファイルの `provider` と `model` で指定する。APIキーは環境変数から読み取る。

## コミットメッセージフォーマット

### Conventional Commits 準拠

生成するメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に準拠する。

```
<type>[optional scope]: <description>
```

使用するtype:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: コードフォーマット（動作に影響しない変更）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルドプロセスや補助ツールの変更
- `ci`: CI設定の変更
- `perf`: パフォーマンス改善

### 言語

コミットメッセージの言語は設定ファイルの `language` で指定可能。デフォルトは `en`（英語）。

## CLI インターフェース

### コマンド

```bash
# コミットメッセージを生成して確認後コミット
autocommit

# 確認なしで即コミット
autocommit --yes
autocommit -y

# 設定ファイルを生成（デフォルト値で作成）
autocommit init
```

### フラグ

| フラグ | 短縮 | 説明 |
|---|---|---|
| `--yes` | `-y` | 確認をスキップして即コミット |

### CLI引数パース

[commander](https://github.com/tj/commander.js) を使用する。

## 設定ファイル

### パス

```
$XDG_CONFIG_HOME/autocommit/config.json5
```

`XDG_CONFIG_HOME` が未設定の場合は `~/.config/autocommit/config.json5` を使用する。

### `autocommit init`

デフォルト値で設定ファイルを生成する（対話式ではない）。既にファイルが存在する場合は上書き確認を行う。

### JSON Schema

設定ファイルのバリデーション用にJSON Schemaを提供する。パッケージ内に `config.schema.json` として同梱し、エディタの補完・検証に利用できるようにする。

```json5
// $schema は config.json5 の先頭で参照可能
{
  "$schema": "https://unpkg.com/autocommit/config.schema.json",
  // ...
}
```

### スキーマ定義

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["anthropic", "openai", "google"],
      "default": "anthropic",
      "description": "LLM provider"
    },
    "model": {
      "type": "string",
      "default": "claude-sonnet-4-20250514",
      "description": "Model name"
    },
    "language": {
      "type": "string",
      "default": "en",
      "description": "Commit message language (ISO 639-1)"
    },
    "ignorePatterns": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["*.lock", "package-lock.json", "bun.lock", "pnpm-lock.yaml"],
      "description": "Glob patterns for files to exclude from diff"
    }
  },
  "required": ["provider", "model"],
  "additionalProperties": false
}
```

### デフォルト設定ファイル（`autocommit init` で生成）

```json5
{
  // LLMプロバイダー: "anthropic" | "openai" | "google"
  "provider": "anthropic",

  // モデル名
  "model": "claude-sonnet-4-20250514",

  // コミットメッセージの言語（ISO 639-1）
  "language": "en",

  // 差分から除外するファイルパターン（glob形式）
  "ignorePatterns": [
    "*.lock",
    "package-lock.json",
    "bun.lock",
    "pnpm-lock.yaml"
  ]
}
```

## 差分の前処理

### ファイルパターンによる除外

設定ファイルの `ignorePatterns` で指定されたglobパターンにマッチするファイルの差分はLLMに送信しない。

- パターンは [minimatch](https://github.com/isaacs/minimatch) 互換のglob形式
- 除外されたファイルがある場合、コミットメッセージ生成時にその旨をLLMに伝える（例: 「ロックファイルの変更も含まれています」）

### トークン制限

差分が大きすぎる場合の対応:
- LLM APIのトークン制限を超える場合はエラーメッセージを表示し、コミット範囲を小さくするよう案内する

## 配布方法

### npm パッケージ

- パッケージ名: `autocommit`
- `bin` フィールドでCLIコマンドを登録
- `npx autocommit` で即時実行可能

```bash
# グローバルインストール
npm install -g autocommit

# npxで実行
npx autocommit
```

## 技術スタック

- ランタイム: Bun（開発）/ Node.js（配布時の互換性）
- 言語: TypeScript
- LLM連携: AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)
- 設定ファイル: JSON5 (`json5`)
- 設定バリデーション: JSON Schema (`config.schema.json`)
- glob: `minimatch`
- CLI引数パース: `commander`
