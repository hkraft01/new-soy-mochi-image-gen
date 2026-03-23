#!/usr/bin/env node
/**
 * promote.js — Copy high-rated images into the reference library
 *
 * Usage:
 *   node scripts/promote.js --run latest --min-rating 4
 *   node scripts/promote.js --run 2026-03-23-1400-osaka --min-rating 3
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const runsDir = path.join(ROOT, 'runs');
const refsDir = path.join(ROOT, 'refs');

// ── CLI args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function get(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : fallback;
}

let runName   = get('--run', 'latest');
const minRating = parseInt(get('--min-rating', '4'), 10);
const destDir   = get('--dest', 'together'); // soy, mochi, or together

// Resolve "latest"
if (runName === 'latest') {
  const runs = fs.readdirSync(runsDir)
    .filter(d => fs.statSync(path.join(runsDir, d)).isDirectory())
    .sort();
  if (!runs.length) { console.error('No runs found.'); process.exit(1); }
  runName = runs[runs.length - 1];
  console.log(`Using latest run: ${runName}`);
}

const runDir      = path.join(runsDir, runName);
const ratingsPath = path.join(runDir, 'ratings.json');

if (!fs.existsSync(ratingsPath)) {
  console.error('No ratings.json found. Run rate.js first.');
  process.exit(1);
}

const ratings = JSON.parse(fs.readFileSync(ratingsPath, 'utf8'));
const winners = Object.entries(ratings)
  .filter(([, score]) => score >= minRating)
  .map(([img]) => img);

if (!winners.length) {
  console.log(`No images rated ${minRating}+ in run ${runName}.`);
  process.exit(0);
}

// ── Promote winners ──────────────────────────────────────────────────────────
const targetDir = path.join(refsDir, destDir);
fs.mkdirSync(targetDir, { recursive: true });

// Load existing refs index or create it
const indexPath = path.join(refsDir, 'index.json');
const index = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  : { promoted: [] };

console.log(`\nPromoting ${winners.length} image(s) to refs/${destDir}/\n`);

for (const img of winners) {
  const src = path.join(runDir, img);
  // Name: <runName>-<img>
  const destName = `${runName}-${img}`;
  const dest = path.join(targetDir, destName);

  fs.copyFileSync(src, dest);
  console.log(`  ${img}  →  refs/${destDir}/${destName}  (${ratings[img]}/5)`);

  index.promoted.push({
    file: `${destDir}/${destName}`,
    rating: ratings[img],
    run: runName,
    source: img,
    promotedAt: new Date().toISOString(),
  });
}

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`\nDone. ${winners.length} image(s) added to the reference library.`);
console.log('These will be used automatically in future generation runs.');
