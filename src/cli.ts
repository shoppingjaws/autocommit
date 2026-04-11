#!/usr/bin/env node
import { execSync } from "node:child_process";
import * as readline from "node:readline";
import { Command } from "commander";
import { initConfig, loadConfig } from "./config.ts";
import { getStagedDiff } from "./diff.ts";
import { generateCommitMessage } from "./generate.ts";

function confirm(message: string): Promise<boolean> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise((resolve) => {
		rl.question(`${message} (y/N) `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y");
		});
	});
}

function commit(message: string): void {
	execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "inherit" });
}

const program = new Command();

program
	.name("autocommit")
	.description("Generate git commit messages from staged diffs using LLM")
	.version("0.1.0");

program
	.command("init")
	.description("Generate config file with default values")
	.option("--force", "Overwrite existing config file")
	.action((opts: { force?: boolean }) => {
		initConfig(opts.force ?? false);
	});

program
	.command("run", { isDefault: true })
	.description("Generate a commit message and commit")
	.option("-y, --yes", "Skip confirmation and commit immediately")
	.action(async (opts: { yes?: boolean }) => {
		const config = loadConfig();
		const { filteredDiff, excludedFiles } = getStagedDiff(
			config.ignorePatterns,
		);

		console.log("コミットメッセージを生成中...");
		const { message, usage } = await generateCommitMessage(
			filteredDiff,
			excludedFiles,
			config,
		);

		console.log("");
		console.log(message);
		console.log("");

		// トークン使用量とコストを表示
		let usageLine = `Tokens: ${usage.promptTokens} in / ${usage.completionTokens} out (${usage.totalTokens} total)`;
		if (
			config.inputCostPerMToken != null &&
			config.outputCostPerMToken != null
		) {
			const cost =
				(usage.promptTokens * config.inputCostPerMToken +
					usage.completionTokens * config.outputCostPerMToken) /
				1_000_000;
			usageLine += ` | Cost: $${cost.toFixed(6)}`;
		}
		console.log(usageLine);
		console.log("");

		if (opts.yes) {
			commit(message);
			return;
		}

		const ok = await confirm("このメッセージでコミットしますか？");
		if (ok) {
			commit(message);
		} else {
			console.log("コミットをキャンセルしました。");
		}
	});

program.parse();
