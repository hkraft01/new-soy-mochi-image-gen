# New Soy & Mochi Image Generator

A clean-slate image generation pipeline for Soy (the fox) and Mochi (the hamster).

## Quick Start

```bash
# Generate images for a scene
node scripts/generate.js --scene osaka --variations 4 --max-refs 2

# Rate the outputs
node scripts/rate.js --run latest

# Promote winners to the reference library
node scripts/promote.js --run latest --min-rating 4
```

## Directory Layout

```
refs/
  soy/          ← approved Soy reference images
  mochi/        ← approved Mochi reference images
  together/     ← approved paired images
prompts/
  scenes/       ← one .md file per scene
runs/           ← one directory per generation run
scripts/
  generate.js   ← main generation script
  rate.js       ← interactive rating CLI
  promote.js    ← promote approved images to refs/
```

## Characters

**Soy** — red fox, fluffy tail, small heart marking on chest, playful and cheeky

**Mochi** — round hamster, chubby cheeks, colorful pastel scarf, sweet and cozy

## Adding a New Scene

Create a file in `prompts/scenes/<name>.md` describing the scene, then run:

```bash
node scripts/generate.js --scene <name> --variations 4
```
