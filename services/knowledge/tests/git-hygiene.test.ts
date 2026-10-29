import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { containsSensitiveText } from '../src/content-safety';

function ignored(path: string) {
  try { execFileSync('git', ['check-ignore', '--no-index', path], { stdio: 'pipe' }); return true; }
  catch (error) { if ((error as { status?: number }).status === 1) return false; throw error; }
}
describe('repository publication hygiene', () => {
  it.each(['../../.env', '../../.env.production', '.env', '.env.staging', '.dev.vars', '.dev.vars.auth', '.dev.vars.public', '.wrangler/state/private.sqlite', 'local-backup.sqlite', 'data/corpus.json', 'data/raw/source.bin', 'data/private-drafts/draft.json', 'local-secret.pem', 'oauth.key', 'request.log'])('excludes local sensitive path %s', path => {
    expect(ignored(path)).toBe(true);
  });
  it.each(['../../.env.example', '.env.example', '.dev.vars.auth.example', '.dev.vars.public.example', 'data/bootstrap-corpus.json', 'data/inventory.json'])('keeps approved public artefact or blank template %s eligible', path => {
    expect(ignored(path)).toBe(false);
  });
  it('keeps credentials empty in all committed configuration templates', () => {
    for (const path of ['../../.env.example', '.env.example', '.dev.vars.auth.example', '.dev.vars.public.example']) {
      const text = readFileSync(path, 'utf8');
      expect(containsSensitiveText(text)).toBe(false);
      for (const line of text.split('\n')) if (/^[A-Z_]*(?:TOKEN|SECRET|ACCESS_KEY)[A-Z_]*=/.test(line)) expect(line.split('=').slice(1).join('=')).toBe('');
    }
  });
  it('has no actual local secret, private-import or key files in the Git index', () => {
    const tracked = execFileSync('git', ['ls-files', '--full-name', '-z', '--', ':/'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    const sensitive = tracked.filter(path => !path.endsWith('.example') && (/(?:^|\/)\.(?:env(?:\.|$)|dev\.vars(?:\.|$))/.test(path) || /\.(?:pem|key|p12|pfx)$/.test(path) || /(?:^|\/)data\/(?:raw\/|corpus\.json|private)/.test(path)));
    expect(sensitive).toEqual([]);
  });
  it('ships only approved, credential-scanned bootstrap bodies', () => {
    const text = readFileSync('data/bootstrap-corpus.json', 'utf8');
    expect(containsSensitiveText(text)).toBe(false);
    const corpus = JSON.parse(text);
    expect(corpus.documents.every((doc: { source: { status: string } }) => doc.source.status === 'approved')).toBe(true);
  });
});
