#!/usr/bin/env node
/**
 * generate.js — Generate Soy & Mochi images
 *
 * Usage:
 *   node scripts/generate.js --scene osaka --variations 4
 *   node scripts/generate.js --scene osaka --format portrait --max-refs 2
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

// ── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function get(flag, fallback) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : fallback;
}
function has(flag) { return argv.includes(flag); }

const scene      = get('--scene', 'scene');
const variations = parseInt(get('--variations', config.defaults.variations), 10);
const format     = get('--format', config.defaults.format);
const maxRefs    = parseInt(get('--max-refs', config.defaults.maxRefs), 10);
const dryRun     = has('--dry-run');

// ── Aspect ratio map ─────────────────────────────────────────────────────────
const aspectRatios = {
  square:    '1:1',
  portrait:  '3:4',
  landscape: '4:3',
  story:     '9:16',
};
const aspectRatio = aspectRatios[format] || '1:1';

// ── Build run directory ──────────────────────────────────────────────────────
const now = new Date();
const stamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '-',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
].join('');
const runName = `${stamp}-${scene}`;
const runDir  = path.join(ROOT, config.dirs.runs, runName);
fs.mkdirSync(runDir, { recursive: true });

// ── Collect reference images ─────────────────────────────────────────────────
function collectRefs(subdir) {
  const dir = path.join(ROOT, config.dirs.refs, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .map(f => path.join(dir, f));
}

const soyRefs      = collectRefs('soy');
const mochiRefs    = collectRefs('mochi');
const togetherRefs = collectRefs('together');
const allRefs      = [...soyRefs, ...mochiRefs, ...togetherRefs].slice(0, maxRefs);

console.log(`\nRefs loaded: ${allRefs.length} (max ${maxRefs})`);
allRefs.forEach(r => console.log(`  • ${path.relative(ROOT, r)}`));

// ── Load scene prompt ────────────────────────────────────────────────────────
function loadScene(sceneName) {
  const scenePath = path.join(ROOT, config.dirs.scenes, `${sceneName}.md`);
  if (fs.existsSync(scenePath)) {
    return fs.readFileSync(scenePath, 'utf8').trim();
  }
  // Fall back to using the scene name as the description
  return `Soy (a cute red fox with a fluffy tail and heart marking on chest) and Mochi (a round chubby hamster with a colorful scarf) having fun in ${sceneName}.`;
}

const sceneText = loadScene(scene);

// ── Style anchor ─────────────────────────────────────────────────────────────
const styleAnchor = `
Cute comic illustration style. Clean outlines. Warm, slightly saturated colors.
NOT photorealistic. Characters have large expressive eyes, soft rounded shapes,
consistent line weight. No text, no watermarks, no logos. Clean composition.
`.trim();

// ── Build full prompt ────────────────────────────────────────────────────────
const basePrompt = `${styleAnchor}\n\n${sceneText}`;

// ── Generate ─────────────────────────────────────────────────────────────────
const scriptPath = config.gemini.scriptPath;
if (!fs.existsSync(scriptPath)) {
  console.error(`Error: generation script not found at ${scriptPath}`);
  process.exit(1);
}

const generated = [];

for (let i = 1; i <= variations; i++) {
  const filename = `v${String(i).padStart(3, '0')}.png`;
  const outputPath = path.join(runDir, filename);

  const variantPrompt = variations > 1
    ? `${basePrompt}\n\n(Variation ${i}: slightly different pose or composition, same characters and style)`
    : basePrompt;

  const refArgs = allRefs.flatMap(r => ['-i', r]);
  const cmd = [
    'uv', 'run', scriptPath,
    '--prompt', variantPrompt,
    '--filename', outputPath,
    '--aspect-ratio', aspectRatio,
    '--resolution', '4K',
    ...refArgs,
  ];

  console.log(`\nGenerating ${filename} (${i}/${variations})...`);

  if (dryRun) {
    console.log('[DRY RUN]', cmd.join(' '));
    generated.push(filename);
    continue;
  }

  let success = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = spawnSync(cmd[0], cmd.slice(1), {
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 180_000,
    });
    if (result.status === 0) { success = true; break; }
    if (attempt < 2) {
      console.log('  Retrying...');
      spawnSync('sleep', ['3']);
    }
  }

  if (success) {
    generated.push(filename);
    console.log(`  Saved: ${path.relative(ROOT, outputPath)}`);
  } else {
    console.error(`  Failed: ${filename}`);
  }
}

// ── Save run metadata ────────────────────────────────────────────────────────
const meta = {
  runName,
  scene,
  format,
  aspectRatio,
  variations,
  maxRefs,
  refs: allRefs.map(r => path.relative(ROOT, r)),
  prompt: basePrompt,
  generatedAt: new Date().toISOString(),
  outputs: generated,
};
fs.writeFileSync(path.join(runDir, 'run-config.json'), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(runDir, 'ratings.json'), JSON.stringify({}, null, 2));

console.log(`\nDone! Run saved to: runs/${runName}/`);
console.log(`Generated ${generated.length} of ${variations} images.`);
console.log(`\nNext step: node scripts/rate.js --run ${runName}`);
