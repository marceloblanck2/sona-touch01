# SØNA Touch 01

[![CI](https://github.com/marceloblanck2/sona-touch01/actions/workflows/ci.yml/badge.svg)](https://github.com/marceloblanck2/sona-touch01/actions/workflows/ci.yml)

Touch-based sensory instrument prototype: gesture, position and color are mapped to sound and visuals in real time, using 432 Hz tuning and golden-ratio based spatial organization. First software prototype of SØM, a perceptual research project by Marcelo Blanck.

**Live demo:** https://sona-touch01.lovable.app/

## Stack

React, TypeScript, Vite, Tailwind, Web Audio API. Built in an AI-assisted workflow: Lovable for generation and deploy, Claude Code for engineering and QA, GitHub as the single record of decisions.

## Quality and testing

- **CI (GitHub Actions)** on every push and pull request: install, lint (non-blocking, debt tracked in #2), unit tests (blocking), production build (blocking).
- **104 unit tests (Vitest + jsdom)** covering the system rules: 432 Hz tuning, interval ratios, scale integrity, note gravity, color-to-pitch mapping and preset persistence.
- **Manual mutation testing** to prove the tests can fail: changing the tuning, comparison operators and clamps was caught by the suite. This exposed one vacuous test, which was fixed.
- **Exploratory testing** for what automation cannot judge: sound perception and UI clarity (see #5).
- **Every finding is an issue** with steps to reproduce, expected vs. actual, root cause and labels for type and priority.

## Known state

The live demo is deployed from `feature/tonal-field`, which diverged from `main`. Analysis, conflict list and reconciliation plan are documented in #10.

## Run locally

```bash
npm ci
npm run dev     # local server
npm test        # unit tests
npm run build   # production build
```

© Marcelo Blanck. All rights reserved.
