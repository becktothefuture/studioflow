import { CONDUIT_ERROR_TAXONOMY } from "./lib/conduit-errors.mjs";

function parseCodeArg(argv) {
  const codeIndex = argv.indexOf("--code");
  if (codeIndex === -1) {
    return null;
  }
  return argv[codeIndex + 1] ?? null;
}

function printEntry(entry) {
  console.log(`[${entry.code}] ${entry.title}`);
  console.log(`cause: ${entry.cause}`);
  console.log(`fastestFix: ${entry.fastestFix}`);
  console.log(`safeFallback: ${entry.safeFallback}`);
}

function printList(entries) {
  console.log("Known StudioFlow conduit error codes:");
  for (const entry of entries) {
    console.log(`- ${entry.code}: ${entry.title}`);
  }
  console.log("");
  console.log("Use `npm run conduit:doctor -- --code <ERROR_CODE>` for full guidance.");
}

function main() {
  const requestedCode = parseCodeArg(process.argv.slice(2));
  const entries = Object.values(CONDUIT_ERROR_TAXONOMY).sort((a, b) => a.code.localeCompare(b.code));

  if (!requestedCode) {
    printList(entries);
    return;
  }

  const entry = CONDUIT_ERROR_TAXONOMY[requestedCode];
  if (!entry) {
    console.error(`Unknown error code: ${requestedCode}`);
    printList(entries);
    process.exit(1);
  }

  printEntry(entry);
}

main();
