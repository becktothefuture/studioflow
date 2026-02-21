import StyleDictionary from 'style-dictionary';
import { promises as fs } from 'fs';
import path from 'path';

const CWD = process.cwd();

async function buildTokens() {
  console.log('Building design tokens...');

  const sd = StyleDictionary.extend({
    source: [path.join(CWD, 'tokens', 'figma-variables.json')],
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: path.join(CWD, 'src', 'styles/'),
        files: [{
          destination: 'tokens.css',
          format: 'css/variables'
        }]
      },
      ts: {
        transformGroup: 'js',
        buildPath: path.join(CWD, 'tokens/'),
        files: [{
          destination: 'tokens.ts',
          format: 'javascript/es6'
        }]
      }
    }
  });

  sd.buildAllPlatforms();

  console.log('✔ Design tokens built successfully!');
}

buildTokens().catch(console.error);
