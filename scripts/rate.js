#!/usr/bin/env node
/**
 * rate.js — Interactively rate generated images
 *
 * Usage:
 *   node scripts/rate.js --run latest
 *   node scripts/rate.js --run 2026-03-23-1400-osaka
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const readline = require('readline');

const ROOT    = path.resolve(__dirname, '..');
const runsDir = path.join(ROOT, 'runs');

// ── CLI args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function get(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : fallback;
}

let runName = get('--run', 'latest');

// Resolve "latest"
if (runName === 'latest') {
  const runs = fs.readdirSync(runsDir)
    .filter(d => fs.statSync(path.join(runsDir, d)).isDirectory())
    .sort();
  if (!runs.length) { console.error('No runs found.'); process.exit(1); }
  runName = runs[runs.length - 1];
  console.log(`Using latest run: ${runName}`);
}

const runDir     = path.join(runsDir, runName);
const ratingsPath = path.join(runDir, 'ratings.json');

if (!fs.existsSync(runDir)) {
  console.error(`Run not found: ${runDir}`);
  process.exit(1);
}

let ratings = {};
if (fs.existsSync(ratingsPath)) {
  ratings = JSON.parse(fs.readFileSync(ratingsPath, 'utf8'));
}

// ── Find images ──────────────────────────────────────────────────────────────
const images = fs.readdirSync(runDir)
  .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
  .sort();

if (!images.length) {
  console.error('No images found in run.');
  process.exit(1);
}

console.log(`\nRating ${images.length} image(s) in: ${runName}`);
console.log('Score 1–5 (1=bad, 5=perfect). Press Enter to skip.\n');

// ── Open image helper ────────────────────────────────────────────────────────
function openImage(imgPath) {
  spawnSync('open', [imgPath], { stdio: 'inherit' });
}

// ── Interactive rating ────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function rateNext(index) {
  if (index >= images.length) {
    rl.close();
    fs.writeFileSync(ratingsPath, JSON.stringify(ratings, null, 2));
    console.log('\nRatings saved.');

    const scored = Object.entries(ratings);
    if (scored.length) {
      console.log('\nSummary:');
      scored.sort((a, b) => b[1] - a[1]).forEach(([img, score]) => {
        console.log(`  ${score}/5  ${img}`);
      });
      const good = scored.filter(([, s]) => s >= 4).map(([img]) => img);
      if (good.length) {
        console.log(`\n${good.length} image(s) rated 4+. Promote with:`);
        console.log(`  node scripts/promote.js --run ${runName} --min-rating 4`);
      }
    }
    return;
  }

  const img = images[index];
  const imgPath = path.join(runDir, img);
  const existing = ratings[img] ? ` (current: ${ratings[img]})` : '';

  openImage(imgPath);

  rl.question(`${img}${existing} → score (1-5, Enter to skip): `, answer => {
    const score = parseInt(answer.trim(), 10);
    if (!isNaN(score) && score >= 1 && score <= 5) {
      ratings[img] = score;
      console.log(`  Saved: ${score}/5`);
    } else {
      console.log('  Skipped.');
    }
    rateNext(index + 1);
  });
}

rateNext(0);
