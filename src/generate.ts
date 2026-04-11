import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Config } from "./config.ts";

const DEFAULT_ENV_VARS: Record<Config["provider"], string> = {
	anthropic: "ANTHROPIC_API_KEY",
	openai: "OPENAI_API_KEY",
	google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

function getApiKey(config: Config): string {
	const envVar = config.apiKeyEnvVar ?? DEFAULT_ENV_VARS[config.provider];
	const key = process.env[envVar];
	if (!key) {
		console.error(`環境変数 ${envVar} が設定されていません。`);
		console.error("apiKeyEnvVar で別の環境変数名を指定することもできます。");
		process.exit(1);
	}
	return key;
}

function getModel(config: Config) {
	const apiKey = getApiKey(config);
	const baseURL = config.baseURL;
	switch (config.provider) {
		case "anthropic":
			return createAnthropic({ apiKey, baseURL })(config.model);
		case "openai":
			return createOpenAI({ apiKey, baseURL })(config.model);
		case "google":
			return createGoogleGenerativeAI({ apiKey, baseURL })(config.model);
	}
}

function buildPrompt(
	diff: string,
	excludedFiles: string[],
	language: string,
): string {
	const lines: string[] = [
		"Generate a git commit message for the following staged changes.",
		"The message MUST follow the Conventional Commits format:",
		"  <type>[optional scope]: <description>",
		"",
		"Available types: feat, fix, docs, style, refactor, test, chore, ci, perf",
		"",
		`Write the commit message in language: ${language}`,
		"",
		"Rules:",
		"- Output ONLY the commit message, nothing else",
		"- The subject line must be under 72 characters",
		"- Use imperative mood for the description",
		"- Do not end the subject line with a period",
	];

	if (excludedFiles.length > 0) {
		lines.push(
			"",
			`Note: The following files were also changed but excluded from the diff: ${excludedFiles.join(", ")}`,
			"Consider mentioning these changes if relevant (e.g., dependency updates).",
		);
	}

	lines.push("", "--- Diff ---", diff);

	return lines.join("\n");
}

export interface GenerateResult {
	message: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export async function generateCommitMessage(
	diff: string,
	excludedFiles: string[],
	config: Config,
): Promise<GenerateResult> {
	const model = getModel(config);
	const prompt = buildPrompt(diff, excludedFiles, config.language);

	const { text, usage } = await generateText({
		model,
		prompt,
	});

	return {
		message: text.trim(),
		usage: {
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.promptTokens + usage.completionTokens,
		},
	};
}
