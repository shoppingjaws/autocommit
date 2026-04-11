# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

autocommit は、ステージされた git diff から LLM を使って Conventional Commits 形式のコミットメッセージを自動生成する CLI ツール。Bun でビルド・実行し、npm パッケージとして配布する。

## Commands

```bash
# 依存関係インストール
bun install

# ビルド（dist/cli.js を生成）
bun build src/cli.ts --outdir dist --target node
# または
bun run build

# 型チェック
bun run typecheck

# リント（自動修正あり / チェックのみ）
bun run lint        # --fix 付き
bun run lint:check

# フォーマット（自動修正あり / チェックのみ）
bun run format
bun run format:check

# テスト（Docker 経由で実行）
bun run test
# または直接
bun test
```

## Architecture

4ファイル構成のシンプルな CLI:

- **`src/cli.ts`** — エントリポイント。Commander で `init` / `run`（デフォルト）の2サブコマンドを定義。`run` はdiff取得→メッセージ生成→確認→コミットの一連のフロー。
- **`src/config.ts`** — `~/.config/autocommit/config.json5` の読み書き。JSON5 形式で、provider / model / language / ignorePatterns 等を管理。
- **`src/diff.ts`** — `git diff --cached` でステージ済み差分を取得し、ignorePatterns でフィルタリング。
- **`src/generate.ts`** — Vercel AI SDK (`ai`) を使い、Anthropic / OpenAI / Google の3プロバイダーに対応。プロンプト構築と `generateText` 呼び出し。

## Key Technical Details

- ランタイム/ビルド: Bun (mise で管理、バージョンは `mise.toml` で固定)
- リンター/フォーマッター: Biome (インデント: タブ、クォート: ダブル)
- 設定ファイル形式: JSON5（コメント記述可能）
- LLM 連携: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)
- CI: GitHub Actions で typecheck → lint:check → format:check → test を実行
- リリース: main ブランチで `package.json` のバージョンが変わると npm publish + GitHub Release を自動作成
