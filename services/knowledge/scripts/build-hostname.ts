import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../.generated/hostname/', import.meta.url));
await mkdir(output, { recursive: true });
await build({ entryPoints: [fileURLToPath(new URL('../src/hostname-gateway.ts', import.meta.url))], outfile: `${output}_worker.js`, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'warning' });
await writeFile(`${output}index.html`, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>UCL AI Society MCP</title><p>Connect your assistant at /mcp. <a href="https://uclai.co.uk/connect/">Connection instructions</a>.</p></html>\n');
console.log('Built the public hostname gateway in .generated/hostname. No credentials, knowledge snapshot or writable storage bindings are included.');
