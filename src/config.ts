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
	/** Prompt template for commit message generation. {{diff}} and {{excludedFiles}} are available as placeholders */
	prompt?: string;
	/** Maximum estimated token count for the entire diff. Largest files are excluded first when exceeded */
	maxDiffTokens?: number;
}

const DEFAULT_CONFIG: Config = {
	provider: "anthropic",
	model: "claude-sonnet-4-20250514",
	language: "en",
	ignorePatterns: ["*.lock", "package-lock.json", "bun.lock", "pnpm-lock.yaml"],
};

const DEFAULT_CONFIG_CONTENT = `{
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

	// Maximum estimated token count for the entire diff. Largest files are excluded first when exceeded
	// Default: 20000
	// "maxDiffTokens": 20000,

	// File patterns to exclude from diff (glob format)
	"ignorePatterns": [
		"*.lock",
		"package-lock.json",
		"bun.lock",
		"pnpm-lock.yaml"
	],

	// Prompt template for commit message generation
	// Available placeholders:
	//   {{language}} — language setting
	//   {{diff}} — staged diff
	//   {{excludedFiles}} — list of excluded files (comma-separated)
	//   {{#excludedFiles}}...{{/excludedFiles}} — section shown only when there are excluded files
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
		console.error(`Config file not found: ${configPath}`);
		console.error("Run `autocommit init` to generate a config file.");
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
		console.error(`Config file already exists: ${configPath}`);
		console.error("Use --force to overwrite.");
		process.exit(1);
	}

	fs.mkdirSync(configDir, { recursive: true });
	fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, "utf-8");
	console.log(`Config file created: ${configPath}`);
}
