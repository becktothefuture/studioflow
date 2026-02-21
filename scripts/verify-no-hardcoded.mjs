import { promises as fs } from 'fs';
import { glob } from 'glob';
import path from 'path';

const CWD = process.cwd();
const IGNORE_PATTERNS = ['node_modules/**', 'dist/**', 'tokens/**'];
const ALLOWED_FILES = ['.tsx', '.jsx', '.css'];

// A more robust regex to find hardcoded values, ignoring comments and certain strings
const HARDCODED_VALUE_REGEX = /(\b(color|background-color|border-color|font-size|padding|margin|width|height)\s*:\s*[^;]*?)(#([0-9a-fA-F]{3}){1,2}|\d+px|\d+rem|\d+em)(?!.*--)/g;

async function verifyNoHardcodedValues() {
  console.log('Verifying no hardcoded style values...');
  const files = await glob('src/**/*.{tsx,jsx,css}', { cwd: CWD, ignore: IGNORE_PATTERNS });
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(CWD, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      let match;
      while ((match = HARDCODED_VALUE_REGEX.exec(line)) !== null) {
        // Simple check to avoid flagging CSS variables definitions
        if (!line.trim().startsWith('--')) {
            console.error(`❌ Hardcoded value found in ${file} on line ${index + 1}:`);
            console.error(`   ${line.trim()}`);
            console.error(`   Found: '${match[3]}'. Please use a design token instead.\n`);
            errorCount++;
        }
      }
    });
  }

  if (errorCount > 0) {
    console.error(`Found ${errorCount} hardcoded values. Please replace them with design tokens.`);
    process.exit(1);
  } else {
    console.log('✔ No hardcoded style values found.');
  }
}

verifyNoHardcodedValues().catch(console.error);
