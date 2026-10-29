import type { KnowledgeDocument } from './types';

// Recognisable credential formats only. This is a safeguard, not a proof that
// arbitrary content contains no sensitive information; review is still required.
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:gh[pousr]_[A-Za-z0-9]{32,}|github_pat_[A-Za-z0-9_]{40,})/,
  /(?:sk-(?:proj-|live-)?[A-Za-z0-9_-]{32,}|AIza[0-9A-Za-z_-]{30,}|GOCSPX-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /https?:\/\/[^\s/<>"']+:[^\s/<>"']+@/,
];
export const containsSensitiveText = (text: string) => patterns.some(pattern => pattern.test(text));
export function redactSensitiveText(text: string): string {
  return patterns.reduce((value, pattern) => value.replace(new RegExp(pattern.source, 'g'), '[REDACTED_CREDENTIAL]'), text);
}
export function redactDocument(document: KnowledgeDocument): { document: KnowledgeDocument; redacted: boolean } {
  const clean = { ...document, title: redactSensitiveText(document.title), text: redactSensitiveText(document.text), sections: document.sections?.map(section => ({ ...section, heading: redactSensitiveText(section.heading), text: redactSensitiveText(section.text) })) };
  return { document: clean, redacted: JSON.stringify(clean) !== JSON.stringify(document) };
}
