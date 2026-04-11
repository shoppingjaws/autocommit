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
	/** 入力トークンの単価（USD / 1Mトークン） */
	inputCostPerMToken?: number;
	/** 出力トークンの単価（USD / 1Mトークン） */
	outputCostPerMToken?: number;
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

	// トークン単価（USD / 1Mトークン）— 設定するとコスト概算を表示
	// "inputCostPerMToken": 3,
	// "outputCostPerMToken": 15,

	// 差分から除外するファイルパターン（glob形式）
	"ignorePatterns": [
		"*.lock",
		"package-lock.json",
		"bun.lock",
		"pnpm-lock.yaml"
	]
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
		inputCostPerMToken: parsed.inputCostPerMToken,
		outputCostPerMToken: parsed.outputCostPerMToken,
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
