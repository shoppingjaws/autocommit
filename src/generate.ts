import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Config } from "./config.ts";

function getModel(config: Config) {
	switch (config.provider) {
		case "anthropic":
			return createAnthropic()(config.model);
		case "openai":
			return createOpenAI()(config.model);
		case "google":
			return createGoogleGenerativeAI()(config.model);
	}
}

function buildPrompt(diff: string, excludedFiles: string[], language: string): string {
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

export async function generateCommitMessage(
	diff: string,
	excludedFiles: string[],
	config: Config,
): Promise<string> {
	const model = getModel(config);
	const prompt = buildPrompt(diff, excludedFiles, config.language);

	const { text } = await generateText({
		model,
		prompt,
	});

	return text.trim();
}
