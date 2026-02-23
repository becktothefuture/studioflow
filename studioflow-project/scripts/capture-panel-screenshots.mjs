#!/usr/bin/env node
/**
 * Capture default and hover-state screenshots of the StudioFlow plugin panel (ui.html).
 * Output: figma-plugins/studioflow-screens/screenshots/
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const uiPath = path.join(projectRoot, 'figma-plugins', 'studioflow-screens', 'ui.html');
const outDir = path.join(projectRoot, 'figma-plugins', 'studioflow-screens', 'screenshots');

const viewport = { width: 239, height: 560 };

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize(viewport);

  const fileUrl = pathToFileURL(uiPath).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Ensure panel is painted
  await page.waitForSelector('.plugin-panel', { state: 'visible' });

  // Default state
  await page.screenshot({
    path: path.join(outDir, 'panel-default.png'),
    clip: { x: 0, y: 0, width: 239, height: 560 },
  });
  console.log('Saved panel-default.png');

  // Hover: Sync to Figma (first section)
  await page.hover('#runAll');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, 'panel-hover-sync-to-figma.png'),
    clip: { x: 0, y: 0, width: 239, height: 560 },
  });
  console.log('Saved panel-hover-sync-to-figma.png');

  // Hover: Sync to Code (second section)
  await page.hover('#exportBtn');
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, 'panel-hover-sync-to-code.png'),
    clip: { x: 0, y: 0, width: 239, height: 560 },
  });
  console.log('Saved panel-hover-sync-to-code.png');

  await browser.close();
  console.log('Screenshots written to:', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
