import { execSync } from "node:child_process";
import { minimatch } from "minimatch";

const DEFAULT_MAX_DIFF_TOKENS = 20_000;

interface DiffResult {
	filteredDiff: string;
	excludedFiles: string[];
	truncatedFiles: string[];
	stat: string;
}

function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export function getStagedDiff(
	ignorePatterns: string[],
	maxDiffTokens?: number,
): DiffResult {
	const stagedFiles = execSync("git diff --cached --name-only", {
		encoding: "utf-8",
	})
		.trim()
		.split("\n")
		.filter(Boolean);

	if (stagedFiles.length === 0) {
		console.error("No staged changes found.");
		process.exit(1);
	}

	const excludedFiles: string[] = [];
	const includedFiles: string[] = [];

	for (const file of stagedFiles) {
		const isExcluded = ignorePatterns.some((pattern) =>
			minimatch(file, pattern, { matchBase: true }),
		);
		if (isExcluded) {
			excludedFiles.push(file);
		} else {
			includedFiles.push(file);
		}
	}

	if (includedFiles.length === 0) {
		console.error("All staged files were excluded by ignorePatterns.");
		process.exit(1);
	}

	// Get per-file diffs
	const perFileDiffs: { file: string; diff: string }[] = includedFiles.map(
		(file) => ({
			file,
			diff: execSync(`git diff --cached -- ${JSON.stringify(file)}`, {
				encoding: "utf-8",
			}),
		}),
	);

	const limit = maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS;
	const truncatedFiles: string[] = [];

	// Sort by token count descending (to exclude largest files first)
	const sortedBySize = perFileDiffs
		.map((entry, i) => ({
			index: i,
			file: entry.file,
			tokens: estimateTokens(entry.diff),
		}))
		.sort((a, b) => b.tokens - a.tokens);

	const included = new Set(perFileDiffs.map((_, i) => i));

	// Exclude largest files while total tokens exceed the limit
	let totalTokens = sortedBySize.reduce((sum, e) => sum + e.tokens, 0);

	for (const entry of sortedBySize) {
		if (totalTokens <= limit) break;
		if (included.size <= 1) break; // Keep at least one file

		included.delete(entry.index);
		totalTokens -= entry.tokens;
		truncatedFiles.push(entry.file);
	}

	// Error if even the last remaining file exceeds the limit
	if (totalTokens > limit) {
		console.error(
			`Diff too large (estimated ${totalTokens} tokens, limit ${limit} tokens).`,
		);
		console.error("Split your changes or increase maxDiffTokens.");
		process.exit(1);
	}

	const filteredDiff = perFileDiffs
		.filter((_, i) => included.has(i))
		.map((e) => e.diff)
		.join("");

	const stat = execSync("git diff --cached --stat", {
		encoding: "utf-8",
	}).trimEnd();

	return { filteredDiff, excludedFiles, truncatedFiles, stat };
}
