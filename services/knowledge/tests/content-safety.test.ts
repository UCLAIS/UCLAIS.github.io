import { describe, expect, it } from 'vitest';
import { containsSensitiveText, redactDocument, redactSensitiveText } from '../src/content-safety';
import { approvedCorpus, validateCorpus } from '../src/core';
import type { Corpus, KnowledgeDocument } from '../src/types';

const document = (text: string): KnowledgeDocument => ({ id: 'tutorial:example', title: 'Teaching example', text, type: 'tutorial', topics: [], archived: true, source: { url: 'https://github.com/UCLAIS/ML-Tutorials-Season-2', status: 'approved' }, sections: [{ id: 'cell-1', heading: 'Code', text, kind: 'code', locator: 'notebook cell 1' }] });
const corpus = (doc: KnowledgeDocument): Corpus => ({ schemaVersion: 1, generatedAt: new Date().toISOString(), documents: [doc], sources: [], learningPaths: [] });

describe('credential redaction and publication guard', () => {
  it.each(['sk-' + 'A1b2C3d4'.repeat(6), 'ghp_' + 'A1b2C3d4'.repeat(5), 'AIza' + 'A1b2C3d4'.repeat(5), 'AKIA' + 'A1B2'.repeat(4), ...['cfk_', 'cfut_', 'cfat_', 'cfoat_'].map(prefix => prefix + 'A1b2C3d4'.repeat(6))])('redacts recognised credential format without echoing it', secret => {
    expect(containsSensitiveText(secret)).toBe(true);
    expect(redactSensitiveText(`key = "${secret}"`)).toBe('key = "[REDACTED_CREDENTIAL]"');
    const result = redactDocument(document(secret));
    expect(result.redacted).toBe(true);
    expect(JSON.stringify(result.document)).not.toContain(secret);
    expect(result.document.sections![0].locator).toBe('notebook cell 1');
  });
  it('rejects unsanitised public candidates with a diagnostic containing no secret', () => {
    const secret = 'sk-' + 'A1b2C3d4'.repeat(6);
    const input = corpus(document(secret));
    const report = validateCorpus(input);
    expect(report.valid).toBe(false); expect(JSON.stringify(report)).not.toContain(secret);
    expect(() => approvedCorpus(input)).toThrow('Credential-like');
    expect(validateCorpus(corpus(redactDocument(input.documents[0]).document)).valid).toBe(true);
  });
  it('preserves environment-based teaching examples and flags credentials in metadata', () => {
    const input = corpus(document('api_key = os.environ["OPENAI_API_KEY"]'));
    expect(validateCorpus(input).valid).toBe(true);
    input.sources.push({ id: 'source:example', title: 'source', url: 'https://example.test/', kind: 'reference', status: 'link-only', documentIds: [], reason: 'ghp_' + 'Ab3d'.repeat(12) });
    expect(validateCorpus(input).valid).toBe(false);
  });
});
