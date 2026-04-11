#!/usr/bin/env node
import { execSync } from "node:child_process";
import * as readline from "node:readline";
import { Command } from "commander";
import { initConfig, loadConfig } from "./config.ts";
import { getStagedDiff } from "./diff.ts";
import { generateCommitMessage } from "./generate.ts";

const c = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
	red: "\x1b[31m",
};

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
	try {
		execSync(`git commit -m ${JSON.stringify(message)}`, { stdio: "pipe" });
	} catch (e) {
		const err = e as { stderr?: Buffer };
		if (err.stderr) {
			process.stderr.write(err.stderr);
		}
		process.exit(1);
	}
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
		const { filteredDiff, excludedFiles, truncatedFiles, stat } = getStagedDiff(
			config.ignorePatterns,
			config.maxDiffTokens,
		);

		console.log(`${c.cyan}${stat}${c.reset}`);
		console.log("");

		if (truncatedFiles.length > 0) {
			console.log(
				`${c.yellow}The following files were truncated due to large diff size: ${truncatedFiles.join(", ")}${c.reset}`,
			);
		}

		console.log(`${c.dim}Generating commit message...${c.reset}`);
		const { message, usage } = await generateCommitMessage(
			filteredDiff,
			[...excludedFiles, ...truncatedFiles],
			config,
		);

		console.log("");
		console.log(`${c.bold}${c.green}${message}${c.reset}`);
		console.log("");

		// Display token usage
		console.log(
			`${c.dim}Tokens: ${usage.promptTokens} in / ${usage.completionTokens} out (${usage.totalTokens} total)${c.reset}`,
		);
		console.log("");

		if (opts.yes) {
			commit(message);
			return;
		}

		const ok = await confirm("Commit with this message?");
		if (ok) {
			commit(message);
		} else {
			console.log(`${c.red}Commit cancelled.${c.reset}`);
		}
	});

program.parse();
