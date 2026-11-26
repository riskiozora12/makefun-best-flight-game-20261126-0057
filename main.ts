// main.ts — hands the game in. Copies game/ and screenshots/ from this
// repository into the output directory and writes dossier.json there with
// buildDossier from vendor/makefun-game.ts, under the scorer's own caps.
// The grader runs this on Node 22; outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// The scorer's caps: 160 KiB of dossier text, at most 4 screenshots of
// 256 KiB each, game/ within 993 files and 48 MiB, paths under 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(path.join(here, "game"), path.join(outDir, "game"), { recursive: true });
  await mkdir(path.join(outDir, "screenshots"), { recursive: true });
  await cp(path.join(here, "screenshots"), path.join(outDir, "screenshots"), { recursive: true });
  const dossier = buildDossier(outDir, CAPS);
  const dossierPath = path.join(outDir, "dossier.json");
  await writeFile(dossierPath, dossier, "utf8");
  const size = (await stat(dossierPath)).size;
  console.log(`wrote ${dossierPath} (${size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
