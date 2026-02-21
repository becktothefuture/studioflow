import { promises as fs } from 'fs';
import path from 'path';

const CWD = process.cwd();

async function verifyTokensSync() {
  console.log('Verifying token files are in sync...');
  try {
    const figmaTokensStat = await fs.stat(path.join(CWD, 'tokens', 'figma-variables.json'));
    const cssTokensStat = await fs.stat(path.join(CWD, 'src', 'styles', 'tokens.css'));

    if (cssTokensStat.mtime < figmaTokensStat.mtime) {
      console.error('❌ Stale tokens: tokens.css is older than figma-variables.json.');
      console.error('   Run `npm run build:tokens` to update.');
      process.exit(1);
    } else {
      console.log('✔ Token files are in sync.');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Token file missing. Run `npm run build:tokens` first.');
      process.exit(1);
    }
    throw error;
  }
}

verifyTokensSync().catch(console.error);
