import * as fs from "node:fs";
import * as path from "node:path";
import JSON5 from "json5";

export interface Config {
	provider: "anthropic" | "openai" | "google";
	model: string;
	apiKeyEnvVar?: string;
	baseURL?: string;
	language: string;
	ignorePatterns: string[];
	/** コミットメッセージ生成時のプロンプト。{{diff}} と {{excludedFiles}} がプレースホルダーとして使える */
	prompt?: string;
	/** diff全体の最大トークン数（推定値）。超過時は大きいファイルから順に除外 */
	maxDiffTokens?: number;
}

const DEFAULT_CONFIG: Config = {
	provider: "anthropic",
	model: "claude-sonnet-4-20250514",
	language: "en",
	ignorePatterns: ["*.lock", "package-lock.json", "bun.lock", "pnpm-lock.yaml"],
};

const DEFAULT_CONFIG_CONTENT = `{
	// LLMプロバイダー: "anthropic" | "openai" | "google"
	"provider": "anthropic",

	// モデル名
	"model": "claude-sonnet-4-20250514",

	// APIキーを格納する環境変数名（省略時はプロバイダーのデフォルトを使用）
	// "apiKeyEnvVar": "ANTHROPIC_API_KEY",

	// カスタムベースURL（プロキシやセルフホスト環境向け）
	// "baseURL": "https://my-proxy.example.com/v1",

	// コミットメッセージの言語（ISO 639-1）
	"language": "en",

	// diff全体の最大トークン数（推定）。超過時は大きいファイルから順に除外
	// デフォルト: 20000
	// "maxDiffTokens": 20000,

	// 差分から除外するファイルパターン（glob形式）
	"ignorePatterns": [
		"*.lock",
		"package-lock.json",
		"bun.lock",
		"pnpm-lock.yaml"
	],

	// コミットメッセージ生成時のプロンプト
	// 使用可能なプレースホルダー:
	//   {{language}} — 言語設定
	//   {{diff}} — ステージされた差分
	//   {{excludedFiles}} — 除外されたファイル一覧（カンマ区切り）
	//   {{#excludedFiles}}...{{/excludedFiles}} — 除外ファイルがある場合のみ表示されるセクション
	"prompt": "Generate a git commit message for the following staged changes.\\nThe message MUST follow the Conventional Commits format:\\n  <type>[optional scope]: <description>\\n\\nAvailable types: feat, fix, docs, style, refactor, test, chore, ci, perf\\n\\nWrite the commit message in language: {{language}}\\n\\nRules:\\n- Output ONLY the commit message, nothing else\\n- The subject line must be under 72 characters\\n- Use imperative mood for the description\\n- Do not end the subject line with a period\\n\\n{{#excludedFiles}}\\nNote: The following files were also changed but excluded from the diff: {{excludedFiles}}\\nConsider mentioning these changes if relevant (e.g., dependency updates).\\n{{/excludedFiles}}\\n\\n--- Diff ---\\n{{diff}}"
}
`;

function getConfigDir(): string {
	const xdgConfigHome =
		process.env.XDG_CONFIG_HOME ||
		path.join(process.env.HOME ?? "~", ".config");
	return path.join(xdgConfigHome, "autocommit");
}

function getConfigPath(): string {
	return path.join(getConfigDir(), "config.json5");
}

export function loadConfig(): Config {
	const configPath = getConfigPath();

	if (!fs.existsSync(configPath)) {
		console.error(`設定ファイルが見つかりません: ${configPath}`);
		console.error("`autocommit init` で設定ファイルを生成してください。");
		process.exit(1);
	}

	const raw = fs.readFileSync(configPath, "utf-8");
	const parsed = JSON5.parse(raw) as Partial<Config>;

	return {
		provider: parsed.provider ?? DEFAULT_CONFIG.provider,
		model: parsed.model ?? DEFAULT_CONFIG.model,
		apiKeyEnvVar: parsed.apiKeyEnvVar,
		baseURL: parsed.baseURL,
		language: parsed.language ?? DEFAULT_CONFIG.language,
		ignorePatterns: parsed.ignorePatterns ?? DEFAULT_CONFIG.ignorePatterns,
		prompt: parsed.prompt,
		maxDiffTokens: parsed.maxDiffTokens,
	};
}

export function initConfig(force: boolean): void {
	const configPath = getConfigPath();
	const configDir = getConfigDir();

	if (fs.existsSync(configPath) && !force) {
		console.error(`設定ファイルは既に存在します: ${configPath}`);
		console.error("上書きするには --force を指定してください。");
		process.exit(1);
	}

	fs.mkdirSync(configDir, { recursive: true });
	fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, "utf-8");
	console.log(`設定ファイルを作成しました: ${configPath}`);
}
