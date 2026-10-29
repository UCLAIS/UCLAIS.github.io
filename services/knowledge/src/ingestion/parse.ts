import { parse } from '@babel/parser';
import type { KnowledgeDocument } from '../types.js';
import { MAX_SOURCE_BYTES, MAX_TEXT_BYTES } from './limits.js';

type Section = NonNullable<KnowledgeDocument['sections']>[number];

function bounded(text: string): void {
  if (new TextEncoder().encode(text).byteLength > MAX_SOURCE_BYTES) throw new Error('Source exceeds the byte limit');
}

export function plainMarkup(text: string): string {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function discoverLinks(text: string): string[] {
  const results = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`\)\}\]]+/g)) {
    const candidate = match[0].replace(/[.,;]+$/, '');
    try {
      const url = new URL(candidate);
      if (!url.username && !url.password && ['http:', 'https:'].includes(url.protocol)) results.add(url.href);
    } catch { /* Malformed text is not a source. */ }
  }
  for (const match of text.matchAll(/pathname:\/\/\/([^\s\)]+)/g)) results.add(`https://uclai.co.uk/${match[1]}`);
  return [...results];
}

export function parseMarkdown(text: string, fallbackTitle: string): { title: string; text: string; sections: Section[] } {
  bounded(text);
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const metadataTitle = frontmatter?.[1].match(/^title:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '');
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^import\s+[^\n]+\n/gm, '').replace(/^export\s+[^\n]+\n/gm, '');
  const clean = plainMarkup(body);
  const title = metadataTitle && !['>-', '|', '>'].includes(metadataTitle) ? metadataTitle : clean.match(/^#\s+(.+)$/m)?.[1] ?? fallbackTitle;
  const sections: Section[] = [];
  let heading = title; let lines: string[] = [];
  const flush = () => {
    const value = lines.join('\n').trim();
    if (value) sections.push({ id: `section-${sections.length + 1}`, heading, text: value, kind: /solution/i.test(heading) ? 'solution' : /hint/i.test(heading) ? 'hint' : /exercise|challenge/i.test(heading) ? 'exercise' : 'explanation' });
    lines = [];
  };
  let inFence = false;
  for (const line of clean.split('\n')) {
    if (/^\s*```|^\s*~~~/.test(line)) inFence = !inFence;
    const match = !inFence && line.match(/^#{1,6}\s+(.+)$/);
    if (match) { flush(); heading = match[1]; }
    else lines.push(line);
  }
  flush();
  return { title, text: clean, sections };
}

export function parseNotebook(input: string, filename: string): { title: string; text: string; type: string; sections: Section[] } {
  bounded(input);
  const data: unknown = JSON.parse(input);
  if (!data || typeof data !== 'object' || !('cells' in data) || !Array.isArray(data.cells) || data.cells.length > 20_000) throw new Error('Invalid notebook cells');
  const sections: Section[] = [];
  const isSolution = /solution/i.test(filename);
  let title = filename.replace(/\.ipynb$/i, '').replace(/[_-]/g, ' ');
  for (const [index, cell] of data.cells.entries()) {
    if (!cell || typeof cell !== 'object' || !['markdown', 'code', 'raw'].includes(cell.cell_type)) throw new Error('Invalid notebook cell');
    if (typeof cell.source !== 'string' && !(Array.isArray(cell.source) && cell.source.every((line: unknown) => typeof line === 'string'))) throw new Error('Invalid notebook cell source');
    const source: string = typeof cell.source === 'string' ? cell.source : cell.source.join('');
    if (!source.trim()) continue;
    const heading = cell.cell_type === 'markdown' ? source.match(/^#{1,6}\s+(.+)$/m)?.[1] : undefined;
    if (heading && sections.length === 0) title = heading;
    const text = cell.cell_type === 'code' ? `\`\`\`python\n${source}\n\`\`\`` : plainMarkup(source);
    sections.push({ id: `cell-${index + 1}`, heading: heading ?? `Cell ${index + 1}`, text, kind: cell.cell_type === 'code' ? 'code' : isSolution || /solution|answer/i.test(heading ?? '') ? 'solution' : /hint/i.test(heading ?? '') ? 'hint' : /exercise|challenge|your turn/i.test(heading ?? '') ? 'exercise' : 'explanation', locator: `notebook cell ${index + 1} (${cell.cell_type})` });
  }
  const text = sections.map(section => `${section.heading}\n${section.text}`).join('\n\n');
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) throw new Error('Extracted notebook text exceeds limit');
  return { title, text, type: isSolution ? 'tutorial-solution' : 'tutorial', sections };
}

// Babel parses syntax only. No require(), import(), eval(), JSX rendering, or
// user-authored expressions are executed, even for JSX/data source files.
export function parseReactCopy(text: string, fallbackTitle: string): { title: string; text: string; sections: Section[] } {
  bounded(text);
  const ast = parse(text, { sourceType: 'module', plugins: ['jsx'] });
  const pieces: string[] = [];
  const walk = (node: any, parent?: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXText') {
      const value = node.value.replace(/\s+/g, ' ').trim();
      if (value) pieces.push(value);
    }
    if (node.type === 'JSXAttribute' && ['title', 'description'].includes(node.name?.name) && node.value?.type === 'StringLiteral') pieces.push(node.value.value);
    if (node.type === 'JSXAttribute' && node.name?.name === 'href' && node.value?.type === 'StringLiteral' && node.value.value.startsWith('mailto:')) pieces.push(node.value.value);
    if (node.type === 'StringLiteral' && parent?.type === 'ArrayExpression' && !/^https?:|\.(woff2|webp|png|jpg)$/.test(node.value)) pieces.push(node.value);
    if (node.type === 'ObjectProperty' && ['name', 'position', 'course', 'year', 'title', 'text'].includes(node.key?.name) && node.value?.type === 'StringLiteral') pieces.push(node.value.value);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) continue;
      if (Array.isArray(value)) for (const item of value) walk(item, node);
      else if (value && typeof value === 'object') walk(value, node);
    }
  };
  walk(ast);
  const clean = [...new Set(pieces)].join('\n\n');
  return { title: fallbackTitle, text: clean, sections: [{ id: 'content', heading: fallbackTitle, text: clean, kind: 'explanation' }] };
}

export function parseHtmlCopy(html: string, fallbackTitle: string): { title: string; text: string; sections: Section[] } {
  bounded(html);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
  const body = main.replace(/<\/(?:h[1-6]|p|div|section|article|li|summary|details)>/gi, '\n\n');
  const text = plainMarkup(body).replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
  return { title: fallbackTitle, text, sections: [{ id: 'content', heading: fallbackTitle, text, kind: 'explanation' }] };
}
