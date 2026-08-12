#!/usr/bin/env node
/*
 * seed-defect.mjs — a review self-check for solo development.
 *
 * Injects exactly one subtle bug into your working tree. You then read the
 * code and try to find it. Because the tool knows something you don't, it
 * supplies the one property a second reviewer normally provides: you cannot
 * confirm you read carefully by consulting your own memory of having read.
 *
 * Usage:
 *   node tools/seed-defect.mjs seed [path ...]   inject one defect
 *   node tools/seed-defect.mjs guess <file> <line>   check a guess
 *   node tools/seed-defect.mjs reveal            give up, show the answer
 *   node tools/seed-defect.mjs clear             revert the defect
 *   node tools/seed-defect.mjs status            is a defect active?
 *
 * SAFETY MODEL — read this before using it:
 *
 *   1. Requires a clean git tree. The revert is `git checkout` on the touched
 *      file, so uncommitted work would be destroyed. The tool refuses to run
 *      rather than risk that.
 *   2. Writes .seed-defect-active.json at the repo root while a defect is
 *      live. ADD THAT FILE TO .gitignore.
 *   3. Install the companion pre-commit hook. Without it, the sole failure
 *      mode of this tool is committing a deliberately broken build — which,
 *      for anything touching health data, is a considerably worse outcome
 *      than the sloppy review it was meant to catch.
 *
 * The tool mutates code mechanically. It has no idea what your code means,
 * so some seeds will be obvious and some will be in dead paths. That is
 * expected. Its value is the reading it forces, not the realism of the bug.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const STATE_FILE = '.seed-defect-active.json';

const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage'];
const EXTS = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];

/*
 * Mutation catalog. Each entry finds a candidate in a line and returns the
 * mutated line. These are chosen to be quiet: no syntax errors, no crashes at
 * import time, nothing that a linter reliably catches. They are the kinds of
 * mistakes that survive to production.
 */
const MUTATIONS = [
  {
    id: 'boundary-loosen',
    describe: 'a comparison boundary was loosened or tightened by one',
    find: /(?<![<>=!])(<=|>=)(?!=)/,
    apply: (m) => (m === '<=' ? '<' : '>'),
  },
  {
    id: 'boundary-tighten',
    describe: 'a strict comparison became inclusive',
    find: /(?<![<>=!])(<|>)(?![<>=])/,
    apply: (m) => `${m}=`,
  },
  {
    id: 'logic-swap',
    describe: 'a logical operator was swapped',
    find: /(&&|\|\|)/,
    apply: (m) => (m === '&&' ? '||' : '&&'),
  },
  {
    id: 'nullish-to-or',
    describe: 'a nullish coalescing operator became a logical or, so falsy values now fall through',
    find: /\?\?/,
    apply: () => '||',
  },
  {
    id: 'optional-chain-dropped',
    describe: 'an optional chain became a plain property access',
    find: /\?\./,
    apply: () => '.',
  },
  {
    id: 'off-by-one',
    describe: 'a numeric literal changed by one',
    find: /\b(\d{1,4})\b/,
    apply: (m) => String(Number(m) + (Math.random() < 0.5 ? 1 : -1)),
  },
  {
    id: 'equality-flip',
    describe: 'an equality check was inverted',
    find: /(===|!==)/,
    apply: (m) => (m === '===' ? '!==' : '==='),
  },
];

function sh(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function repoRoot() {
  try {
    return sh('git rev-parse --show-toplevel');
  } catch {
    fail('Not inside a git repository.');
  }
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function statePath() {
  return resolve(repoRoot(), STATE_FILE);
}

function readState() {
  const p = statePath();
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

/*
 * Lines that should never be mutated: comments, imports, and anything that
 * looks like it is inside a string. Mutating a comment produces a defect that
 * cannot be found by reasoning about behaviour, which teaches nothing.
 */
function isSkippableLine(line) {
  const t = line.trim();
  if (t === '') return true;
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  if (t.startsWith('import ') || t.startsWith('export ') && t.includes('from ')) return true;
  return false;
}

function candidateFiles(args) {
  const root = repoRoot();

  // Explicit paths win. Otherwise use files changed since the last commit,
  // falling back to everything tracked under src/.
  let files = args.length
    ? args
    : sh('git diff --name-only HEAD~1 2>/dev/null || true')
        .split('\n')
        .filter(Boolean);

  if (!files.length) {
    files = sh('git ls-files src').split('\n').filter(Boolean);
  }

  return files
    .map((f) => resolve(root, f))
    .filter((f) => existsSync(f))
    .filter((f) => EXTS.some((e) => f.endsWith(e)))
    .filter((f) => !SKIP_DIRS.some((d) => f.includes(`/${d}/`)));
}

function seed(args) {
  if (readState()) {
    fail(`A defect is already active. Run 'clear' or 'reveal' first.`);
  }

  const dirty = sh('git status --porcelain');
  if (dirty) {
    fail(
      'Working tree is not clean.\n' +
        '  This tool reverts by checking out the file, which would destroy\n' +
        '  uncommitted work. Commit or stash first.'
    );
  }

  const files = candidateFiles(args);
  if (!files.length) fail('No candidate source files found.');

  // Try random file/mutation pairs until one applies.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const file = files[Math.floor(Math.random() * files.length)];
    const mutation = MUTATIONS[Math.floor(Math.random() * MUTATIONS.length)];
    const lines = readFileSync(file, 'utf8').split('\n');

    const eligible = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => !isSkippableLine(line) && mutation.find.test(line));

    if (!eligible.length) continue;

    const target = eligible[Math.floor(Math.random() * eligible.length)];
    const original = target.line;
    const mutated = original.replace(mutation.find, (m) => mutation.apply(m));

    if (mutated === original) continue;

    lines[target.i] = mutated;
    writeFileSync(file, lines.join('\n'));

    writeFileSync(
      statePath(),
      JSON.stringify(
        {
          file: relative(repoRoot(), file),
          line: target.i + 1,
          mutationId: mutation.id,
          describe: mutation.describe,
          original,
          mutated,
          seededAt: new Date().toISOString(),
        },
        null,
        2
      )
    );

    console.log(`
  One defect seeded across ${files.length} candidate file(s).

  Go read the code. When you think you have it:
    node tools/seed-defect.mjs guess <file> <line>

  Do not commit until this is cleared.
`);
    return;
  }

  fail('Could not find anywhere to seed a defect. Try passing explicit paths.');
}

function guess(args) {
  const state = readState();
  if (!state) fail('No active defect.');

  const [file, line] = args;
  if (!file || !line) fail('Usage: guess <file> <line>');

  const fileMatch = state.file.endsWith(file) || file.endsWith(state.file);
  const lineMatch = Number(line) === state.line;

  if (fileMatch && lineMatch) {
    console.log(`
  Found it. ${state.file}:${state.line}
  ${state.describe}.

  Reverting.
`);
    clear();
  } else if (fileMatch) {
    console.log(`\n  Right file, wrong line. Keep looking.\n`);
  } else {
    console.log(`\n  Not there. Keep looking.\n`);
  }
}

function reveal() {
  const state = readState();
  if (!state) fail('No active defect.');

  console.log(`
  ${state.file}:${state.line}
  ${state.describe}

  before: ${state.original.trim()}
  after:  ${state.mutated.trim()}

  Worth noting which mutation slipped past — a pattern in what you miss is
  more useful than any single miss.

  Reverting.
`);
  clear();
}

function clear() {
  const state = readState();
  if (!state) {
    console.log('\n  No active defect.\n');
    return;
  }
  execSync(`git checkout -- "${state.file}"`, { cwd: repoRoot() });
  unlinkSync(statePath());
  console.log(`  ${state.file} restored.\n`);
}

function status() {
  const state = readState();
  console.log(
    state
      ? `\n  ACTIVE — a defect is live in the working tree (seeded ${state.seededAt}).\n  Do not commit.\n`
      : '\n  Clean — no active defect.\n'
  );
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'seed':
    seed(rest);
    break;
  case 'guess':
    guess(rest);
    break;
  case 'reveal':
    reveal();
    break;
  case 'clear':
    clear();
    break;
  case 'status':
    status();
    break;
  default:
    console.log(`
  seed-defect — review self-check

    seed [path ...]      inject one defect
    guess <file> <line>  check a guess
    reveal               show the answer
    clear                revert
    status               is a defect active?
`);
}
