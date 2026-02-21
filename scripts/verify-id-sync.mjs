import { promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

const CWD = process.cwd();

// This is a placeholder. In a real project, you would fetch this from the Figma API.
const MOCK_FIGMA_IDS = [
  'sfid:hero:title',
  'sfid:hero:subtitle',
  'sfid:hero:cta-button',
  'sfid:footer:copyright',
];

async function verifyIdSync() {
  console.log('Verifying data-sfid attributes against Figma layer names...');
  const files = await glob('src/**/*.tsx', { cwd: CWD });
  const codeIds = new Set();
  let errorCount = 0;

  for (const file of files) {
    const content = await fs.readFile(path.join(CWD, file), 'utf-8');
    const matches = content.match(/data-sfid="([^"]+)"/g) || [];
    matches.forEach(match => {
      const id = match.replace('data-sfid="', '').replace('"', '');
      codeIds.add(id);
    });
  }

  const figmaIdSet = new Set(MOCK_FIGMA_IDS);

  // Find IDs in code but not in Figma
  for (const id of codeIds) {
    if (!figmaIdSet.has(id)) {
      console.error(`❌ ID mismatch: Found '${id}' in code, but not in Figma mock data.`);
      errorCount++;
    }
  }

  // Find IDs in Figma but not in code
  for (const id of figmaIdSet) {
    if (!codeIds.has(id)) {
      console.error(`❌ ID mismatch: Found '${id}' in Figma mock data, but not in code.`);
      errorCount++;
    }
  }

  if (errorCount > 0) {
    console.error(`Found ${errorCount} ID mismatches. Please sync your Figma layers and code.`);
    process.exit(1);
  } else {
    console.log('✔ All data-sfid attributes are in sync with Figma layers.');
  }
}

verifyIdSync().catch(console.error);
