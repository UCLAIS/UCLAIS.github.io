import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { KnowledgeDocument } from '../types.js';

const run = promisify(execFile);
type PdfPage = { page: number; text: string; confidence?: number };

async function ocrPdf(filename: string, cacheDir: string, enabled: boolean): Promise<PdfPage[]> {
  const inputHash = createHash('sha256').update(await readFile(filename)).digest('hex');
  const cacheFile = path.join(cacheDir, `ocr-${inputHash}.json`);
  try {
    if ((await stat(cacheFile)).size > 12 * 1024 * 1024) throw new Error('OCR cache exceeds limit');
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cached.inputHash === inputHash && Array.isArray(cached.pages)) return cached.pages;
    throw new Error('Invalid OCR cache');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!enabled) throw new Error('PDF has no extractable text; use --ocr on macOS or supply an accessible original');
  if (process.platform !== 'darwin') throw new Error('Image-only PDF requires OCR; macOS Vision is unavailable on this platform');
  // Check tools first. Never invoke xcode-select --install or trigger an OS prompt.
  await run('/usr/bin/xcode-select', ['-p'], { timeout: 5_000 });
  const swiftSource = fileURLToPath(new URL('./pdf_ocr.swift', import.meta.url));
  const sourceHash = createHash('sha256').update(await readFile(swiftSource)).digest('hex').slice(0, 16);
  const executable = path.join(cacheDir, `pdf-ocr-${sourceHash}`);
  try { await stat(executable); }
  catch {
    const moduleCache = path.join(cacheDir, 'swift-module-cache');
    await mkdir(moduleCache, { recursive: true });
    await run('/usr/bin/swiftc', ['-module-cache-path', moduleCache, swiftSource, '-o', executable], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
  }
  const { stdout } = await run(executable, [filename], { timeout: 180_000, maxBuffer: 12 * 1024 * 1024 });
  const pages: PdfPage[] = JSON.parse(stdout);
  if (!Array.isArray(pages) || pages.length > 100 || pages.some(page => !Number.isInteger(page.page) || typeof page.text !== 'string')) throw new Error('Invalid OCR response');
  await writeFile(cacheFile, JSON.stringify({ inputHash, extractionMethod: 'macos-vision-ocr', pages }) + '\n', { mode: 0o600 });
  return pages;
}

export async function extractPdf(filename: string, title: string, options: { ocr?: boolean; cacheDir?: string } = {}): Promise<{ title: string; text: string; sections: NonNullable<KnowledgeDocument['sections']>; extractionMethod: 'pypdf' | 'macos-vision-ocr' }> {
  const { stdout } = await run(process.env.KNOWLEDGE_PYTHON || 'python3', [fileURLToPath(new URL('./extract_pdf.py', import.meta.url)), filename], { timeout: 45_000, maxBuffer: 12 * 1024 * 1024 });
  let pages: PdfPage[] = JSON.parse(stdout);
  let extractionMethod: 'pypdf' | 'macos-vision-ocr' = 'pypdf';
  if (!pages.some(page => page.text.trim()) && options.cacheDir) {
    pages = await ocrPdf(filename, options.cacheDir, !!options.ocr);
    extractionMethod = 'macos-vision-ocr';
  }
  const sections = pages.filter(page => page.text.trim()).map(page => ({ id: `page-${page.page}`, heading: `Page ${page.page}`, text: page.text, kind: 'explanation' as const, locator: `page ${page.page}` }));
  if (!sections.length) throw new Error('PDF has no extractable text; OCR or an accessible original is required');
  return { title, sections, text: sections.map(section => `${section.heading}\n${section.text}`).join('\n\n'), extractionMethod };
}
