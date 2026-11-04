import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.generated/management-gateway', { recursive: true });
await build({ entryPoints: ['src/management/gateway.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: '.generated/management-gateway/_worker.js' });
await writeFile('.generated/management-gateway/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }) + '\n');
// Direct Upload includes a passive asset alongside the advanced-mode Worker.
// Every route still enters the Worker; no management UI or credentials live here.
await writeFile('.generated/management-gateway/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Society Management</title><main><h1>Society management is temporarily unavailable.</h1><p>Please try again shortly.</p></main></html>\n');
