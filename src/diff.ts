import { execSync } from "node:child_process";
import { minimatch } from "minimatch";

interface DiffResult {
	filteredDiff: string;
	excludedFiles: string[];
}

export function getStagedDiff(ignorePatterns: string[]): DiffResult {
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

	const filteredDiff = execSync(
		`git diff --cached -- ${includedFiles.map((f) => JSON.stringify(f)).join(" ")}`,
		{ encoding: "utf-8" },
	);

	return { filteredDiff, excludedFiles };
}
