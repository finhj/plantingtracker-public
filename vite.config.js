import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
 
/*
 * package.json is read with readFileSync rather than imported, because a plain
 * `import pkg from './package.json'` needs an import attribute under ESM and
 * fails on some Node versions. Reading the file avoids that entirely.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
 
/*
 * Vercel sets VERCEL_GIT_COMMIT_SHA automatically on every deployment.
 * Local builds fall back to "local" so the badge still renders in dev.
 */
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || 'local';
 
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(commitSha.slice(0, 7)),
  },
});
 
