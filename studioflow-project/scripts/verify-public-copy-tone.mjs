import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..");

const scopedFiles = [
  path.join(workspaceRoot, "README.md"),
  path.join(projectRoot, "README.md"),
  path.join(projectRoot, "src", "components", "Hero", "HeroLogic.tsx"),
  path.join(projectRoot, "src", "components", "Hero", "HeroLayout.tsx")
];

const rules = [
  { label: "`not ... but`", regex: /\bnot\b[\s\S]{0,80}\bbut\b/i },
  { label: "`without`", regex: /\bwithout\b/i },
  { label: "`rather than`", regex: /\brather than\b/i },
  { label: "`instead of`", regex: /\binstead of\b/i },
  { label: "`versus`", regex: /\bversus\b/i },
  { label: "`vs`", regex: /\bvs\.?\b/i },
  { label: "`never`", regex: /\bnever\b/i }
];

async function checkFile(filePath) {
  const rel = path.relative(workspaceRoot, filePath);
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const problems = [];

  lines.forEach((line, i) => {
    rules.forEach((rule) => {
      if (rule.regex.test(line)) {
        problems.push(`${rel}:${i + 1} contains ${rule.label}`);
      }
    });
  });

  return problems;
}

async function main() {
  const problems = [];

  for (const filePath of scopedFiles) {
    try {
      const found = await checkFile(filePath);
      problems.push(...found);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      problems.push(`${path.relative(workspaceRoot, filePath)}:1 read failure (${detail})`);
    }
  }

  if (problems.length > 0) {
    console.error("Public copy tone verification failed:\n");
    problems.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log(`Public copy tone verification passed for ${scopedFiles.length} files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
