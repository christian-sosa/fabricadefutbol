import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const contextPath = path.join(process.cwd(), "AGENT_CONTEXT.json");

function gitLines(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectChangedFiles() {
  const explicitIndex = process.argv.indexOf("--files");
  if (explicitIndex !== -1) {
    return process.argv.slice(explicitIndex + 1).filter(Boolean);
  }

  return Array.from(
    new Set([
      ...gitLines(["diff", "--name-only", "HEAD", "--"]),
      ...gitLines(["diff", "--name-only", "--cached", "--"]),
      ...gitLines(["ls-files", "--others", "--exclude-standard"])
    ])
  ).sort();
}

function main() {
  if (!existsSync(contextPath)) {
    console.error("AGENT_CONTEXT.json not found.");
    process.exitCode = 1;
    return;
  }

  const context = JSON.parse(readFileSync(contextPath, "utf8"));
  const changedFiles = collectChangedFiles();
  const matches = [];

  for (const rule of context.impact_rules ?? []) {
    const patterns = (rule.regex ?? []).map((pattern) => new RegExp(pattern));
    const files = changedFiles.filter((file) => patterns.some((pattern) => pattern.test(file)));
    if (files.length) {
      matches.push({ rule, files });
    }
  }

  console.log(`Agent impact check: ${changedFiles.length} changed file(s) inspected.`);

  if (!matches.length) {
    console.log("No cross-repo impact rules matched.");
    return;
  }

  console.log("");
  console.log("Cross-repo review required:");
  for (const { rule, files } of matches) {
    console.log("");
    console.log(`- ${rule.id}: ${rule.description}`);
    console.log(`  Matched files: ${files.join(", ")}`);
    if (rule.review_repository) console.log(`  Review repo: ${rule.review_repository}`);
    if (rule.review_files?.length) console.log(`  Review files: ${rule.review_files.join(", ")}`);
    if (rule.suggested_marts?.length) console.log(`  Suggested marts: ${rule.suggested_marts.join(", ")}`);
    if (rule.suggested_commands?.length) {
      console.log("  Suggested commands:");
      for (const command of rule.suggested_commands) console.log(`    ${command}`);
    }
  }
}

main();
