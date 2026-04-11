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
		console.error("ステージされた変更がありません。");
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
		console.error(
			"すべてのステージされたファイルが ignorePatterns により除外されました。",
		);
		process.exit(1);
	}

	// ファイルごとの差分を取得
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

	// トークン数の降順でソート（大きいファイルから除外するため）
	const sortedBySize = perFileDiffs
		.map((entry, i) => ({
			index: i,
			file: entry.file,
			tokens: estimateTokens(entry.diff),
		}))
		.sort((a, b) => b.tokens - a.tokens);

	const included = new Set(perFileDiffs.map((_, i) => i));

	// 全体のトークン数が上限を超えている間、最大のファイルから除外
	let totalTokens = sortedBySize.reduce((sum, e) => sum + e.tokens, 0);

	for (const entry of sortedBySize) {
		if (totalTokens <= limit) break;
		if (included.size <= 1) break; // 最後の1ファイルは残す

		included.delete(entry.index);
		totalTokens -= entry.tokens;
		truncatedFiles.push(entry.file);
	}

	// 最後の1ファイルでも超過している場合はエラー
	if (totalTokens > limit) {
		console.error(
			`差分が大きすぎます（推定 ${totalTokens} トークン、上限 ${limit} トークン）。`,
		);
		console.error("変更を分割するか、maxDiffTokens の値を増やしてください。");
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
