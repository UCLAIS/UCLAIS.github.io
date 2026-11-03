import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.generated/management-gateway', { recursive: true });
await build({ entryPoints: ['src/management/gateway.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: '.generated/management-gateway/_worker.js' });
await writeFile('.generated/management-gateway/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }) + '\n');
