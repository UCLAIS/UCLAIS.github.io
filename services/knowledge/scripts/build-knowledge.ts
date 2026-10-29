import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildGithubKnowledge } from '../src/ingestion/github-content';
import type { Corpus } from '../src/types';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
try {
  const revision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const generatedAt = new Date(execFileSync('git', ['show', '-s', '--format=%cI', revision], { cwd: repoRoot, encoding: 'utf8' }).trim()).toISOString();
  const baseline = JSON.parse(await readFile(new URL('../data/bootstrap-corpus.json', import.meta.url), 'utf8')) as Corpus;
  const { report } = await buildGithubKnowledge({ repoRoot, baseline, repository: process.env.GITHUB_REPOSITORY || 'UCLAIS/UCLAIS.github.io', revision, generatedAt, outputDirectory: path.resolve(fileURLToPath(new URL('../.generated/', import.meta.url))) });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // Validation errors deliberately omit document bodies and credentials.
  console.error(error instanceof Error && !('code' in error) && !error.name.startsWith('Zod') ? error.message : 'Knowledge build failed. Check the folder metadata, input files and repository provenance. Source contents were not logged.');
  process.exitCode = 1;
}
