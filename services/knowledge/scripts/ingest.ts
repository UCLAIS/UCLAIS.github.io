import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { KnowledgeImporter, writeImportResults } from '../src/ingestion/importer.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const dataDir = path.resolve(fileURLToPath(new URL('../data/', import.meta.url)));
const importer = new KnowledgeImporter({ repoRoot, dataDir, offline: process.argv.includes('--offline'), ocr: process.argv.includes('--ocr'), onProgress: console.log });
const corpus = await importer.import();
console.log(JSON.stringify(await writeImportResults(corpus, dataDir), null, 2));
if (corpus.sources.some(source => source.kind === 'tutorial-repository' && source.status === 'blocked')) process.exitCode = 2;
