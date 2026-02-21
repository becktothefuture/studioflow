import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const tokenPath = path.join(rootDir, "tokens", "figma-variables.json");
const assetsDir = path.join(rootDir, "assets");

const files = {
  shaderMp4: path.join(assetsDir, "studioflow-shader-loop.mp4"),
  shaderWebm: path.join(assetsDir, "studioflow-shader-loop.webm"),
  shaderStill: path.join(assetsDir, "studioflow-shader-still.png"),
  dividerMp4: path.join(assetsDir, "divider-loop.mp4"),
  dividerWebm: path.join(assetsDir, "divider-loop.webm"),
  dividerGif: path.join(assetsDir, "studioflow-divider.gif"),
  dividerPng: path.join(assetsDir, "studioflow-divider.png"),
  logo: path.join(assetsDir, "studioflow-logo.png")
};

function parseHex(hex) {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Unsupported color value "${hex}"`);
  }
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  };
}

function hexToFfmpeg(color) {
  return `0x${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b.toString(16).padStart(2, "0")}`;
}

function duotoneLut(ink, signal) {
  const dr = signal.r - ink.r;
  const dg = signal.g - ink.g;
  const db = signal.b - ink.b;
  return `lutrgb=r='${ink.r}+val*${dr}/255':g='${ink.g}+val*${dg}/255':b='${ink.b}+val*${db}/255'`;
}

async function run(bin, args) {
  await execFileAsync(bin, args, {
    cwd: rootDir,
    maxBuffer: 1024 * 1024 * 10
  });
}

async function loadColors() {
  const json = JSON.parse(await fs.readFile(tokenPath, "utf8"));
  const ink = json?.color?.brand?.ink?.value;
  const signal = json?.color?.brand?.signal?.value;
  if (typeof ink !== "string" || typeof signal !== "string") {
    throw new Error("Missing brand colors in tokens/figma-variables.json");
  }
  return { ink: parseHex(ink), signal: parseHex(signal) };
}

async function buildShader(ink, signal) {
  const filter = [
    "geq=lum='128+42*sin((X+T*96)/25)+36*sin((Y-T*74)/19)+24*sin((X+Y+T*48)/31)':cb=128:cr=128",
    "noise=alls=8:allf=t+u",
    "eq=contrast=1.18:brightness=-0.06",
    "drawgrid=w=6:h=6:t=1:c=white@0.11",
    duotoneLut(ink, signal),
    "format=yuv420p"
  ].join(",");

  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "nullsrc=s=1600x900:r=30:d=6",
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    files.shaderMp4
  ]);

  await run("ffmpeg", [
    "-y",
    "-i",
    files.shaderMp4,
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "34",
    "-b:v",
    "0",
    files.shaderWebm
  ]);

  await run("ffmpeg", ["-y", "-i", files.shaderMp4, "-frames:v", "1", files.shaderStill]);
}

async function buildDivider(ink, signal) {
  const filter = [
    "geq=lum='132+42*sin((X+T*148)/34)+20*sin((Y+T*20)/4)+18*sin((X+Y+T*52)/27)':cb=128:cr=128",
    "noise=alls=10:allf=t+u",
    "eq=contrast=1.24:brightness=-0.08",
    "drawgrid=w=4:h=4:t=1:c=white@0.18",
    duotoneLut(ink, signal),
    "format=yuv420p"
  ].join(",");

  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "nullsrc=s=1600x30:r=24:d=3",
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    files.dividerMp4
  ]);

  await run("ffmpeg", [
    "-y",
    "-i",
    files.dividerMp4,
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "36",
    "-b:v",
    "0",
    files.dividerWebm
  ]);

  await run("ffmpeg", ["-y", "-i", files.dividerMp4, "-frames:v", "1", files.dividerPng]);

  await run("ffmpeg", [
    "-y",
    "-i",
    files.dividerMp4,
    "-vf",
    "fps=10,split[s0][s1];[s0]palettegen=max_colors=32[p];[s1][p]paletteuse=dither=sierra2_4a",
    files.dividerGif
  ]);

  await run("convert", [files.dividerGif, "-layers", "Optimize", files.dividerGif]);
}

async function buildLogo(ink, signal) {
  const i = hexToFfmpeg(ink);
  const s = hexToFfmpeg(signal);
  const filter = [
    `drawbox=x=0:y=0:w=512:h=512:color=${i}:t=fill`,
    `drawbox=x=54:y=54:w=404:h=404:color=${s}@0.12:t=fill`,
    `drawbox=x=54:y=54:w=404:h=404:color=${s}@0.84:t=4`,
    `drawbox=x=110:y=112:w=140:h=32:color=${s}@0.98:t=fill`,
    `drawbox=x=110:y=240:w=140:h=32:color=${s}@0.98:t=fill`,
    `drawbox=x=110:y=366:w=140:h=32:color=${s}@0.98:t=fill`,
    `drawbox=x=110:y=112:w=32:h=160:color=${s}@0.98:t=fill`,
    `drawbox=x=218:y=240:w=32:h=158:color=${s}@0.98:t=fill`,
    `drawbox=x=302:y=112:w=32:h=286:color=${s}@0.98:t=fill`,
    `drawbox=x=302:y=112:w=126:h=32:color=${s}@0.98:t=fill`,
    `drawbox=x=302:y=240:w=98:h=32:color=${s}@0.98:t=fill`,
    "noise=alls=3:allf=u"
  ].join(",");

  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=512x512:d=1",
    "-vf",
    filter,
    "-frames:v",
    "1",
    files.logo
  ]);
}

async function main() {
  await fs.mkdir(assetsDir, { recursive: true });
  const { ink, signal } = await loadColors();

  await buildShader(ink, signal);
  await buildDivider(ink, signal);
  await buildLogo(ink, signal);

  console.log("Brand assets generated:");
  Object.values(files).forEach((file) => {
    console.log(`- ${path.relative(rootDir, file)}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
