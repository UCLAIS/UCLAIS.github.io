import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Corpus, KnowledgeDocument, LearningPath, SourceRecord } from '../types.js';
import { discoverLinks, parseHtmlCopy, parseMarkdown, parseNotebook, parseReactCopy } from './parse.js';
import { extractPdf } from './pdf.js';
import { canonicalImportedContent } from './reconcile.js';
import { publicGuidance } from '../guidance.js';
import { redactDocument } from '../content-safety.js';
import { LUMA_FEED_URL } from '../luma.js';
import { containedPath, decodeText, fetchApproved, MAX_PDF_BYTES, MAX_SOURCE_BYTES, MAX_TEXT_BYTES, sourceId, TEACHING_REPOSITORIES, validateRepositoryPath } from './security.js';

const run = promisify(execFile);
type Parsed = { title: string; text: string; sections: NonNullable<KnowledgeDocument['sections']>; extractionMethod?: 'pypdf' | 'macos-vision-ocr' };
type Entry = { path: string; type: string; sha: string; size?: number; mode: string };
type ImportOptions = { repoRoot: string; dataDir: string; offline?: boolean; ocr?: boolean; onProgress?: (message: string) => void };

const PAGE_SOURCES = [
  ['src/components/Society/Home.js', '/', 'UCL AI Society', 'society'],
  ['src/components/Society/About.js', '/about-us/', 'About UCL AI Society', 'society'],
  ['src/components/Society/Initiatives.js', '/our-initiatives/', 'Society initiatives', 'society'],
  ['src/components/Society/Nexus.js', '/our-initiatives/Nexus-Labs/', 'Nexus Labs', 'programme'],
  ['src/components/Society/Opportunities.js', '/our-initiatives/opportunities/', 'Events and opportunities', 'society'],
  ['src/components/Society/shared.js', '/our-initiatives/opportunities/', 'Society programmes and partnerships', 'society'],
  ['src/components/Society/content.js', '/our-initiatives/Nexus-Labs/', 'Research pillars and society links', 'society'],
  ['src/data/committee.js', '/about-us/', 'UCL AI Society committee', 'committee'],
] as const;

const topicRules: [string, RegExp][] = [
  ['python', /python|numpy|pandas|matplotlib/i], ['machine-learning', /learning|regression|classification|sklearn|svm|clustering/i],
  ['neural-networks', /neural|network|deep learning|cnn|rnn/i], ['computer-vision', /vision|visual|opencv|image|gan|vae/i],
  ['natural-language-processing', /nlp|language|transformer|attention|gpt|text/i], ['reinforcement-learning', /reinforce|q-learning|actor.critic|sarsa/i],
  ['ai-safety', /safety|ethics|privacy|fairness|human.cent/i], ['society', /society|committee|membership|nexus|agentverse/i],
];

function topics(title: string, text: string): string[] { return topicRules.filter(([, rule]) => rule.test(title + '\n' + text.slice(0, 2000))).map(([topic]) => topic); }
function docId(prefix: string, key: string): string { return `${prefix}:${createHash('sha256').update(key).digest('hex').slice(0, 20)}`; }
function encodedPath(value: string): string { return value.split('/').map(encodeURIComponent).join('/'); }
function message(error: unknown): string { return (error instanceof Error ? error.message : String(error)).slice(0, 500); }

export class KnowledgeImporter {
  private documents: KnowledgeDocument[] = [];
  private sources = new Map<string, SourceRecord>();
  private rawDirectory: string;
  private revision = 'working-tree';
  private progress: (message: string) => void;
  private fetchedAt = new Map<string, string>();

  constructor(private options: ImportOptions) {
    this.rawDirectory = path.join(options.dataDir, 'raw');
    this.progress = options.onProgress ?? (() => {});
  }

  private addSource(record: Omit<SourceRecord, 'id'>): SourceRecord {
    const id = sourceId(record.url);
    const existing = this.sources.get(id);
    if (existing) {
      const ranked = { 'link-only': 0, blocked: 1, missing: 1, 'review-required': 2, imported: 3 };
      const preferred = ranked[record.status] >= ranked[existing.status] ? record : existing;
      const next = { ...existing, ...preferred, id, documentIds: [...new Set([...existing.documentIds, ...record.documentIds])] };
      this.sources.set(id, next);
      return next;
    }
    const next = { id, ...record };
    this.sources.set(id, next);
    return next;
  }

  private recordLinks(input: string, year?: string): void {
    for (const url of discoverLinks(input)) {
      const host = new URL(url).hostname;
      const isCalendar = host === 'luma.com' && (new URL(url).pathname === '/UCLAISociety' || new URL(url).pathname === '/embed/calendar/cal-3vytj1DeqX8k7mk/events');
      const kind = isCalendar ? 'events-calendar' : /canva\.com$/.test(host) ? 'slides' : /(?:youtube\.com|youtu\.be|zoom\.us)$/.test(host) ? 'recording' : host === 'github.com' ? 'repository-link' : 'external-reference';
      this.addSource({ url, title: url, kind, status: 'link-only', year, documentIds: [], reason: kind === 'events-calendar' ? 'Calendar link retained in this release; list_events queries the approved public Luma subscription separately with retrieval and expiry times.' : kind === 'slides' ? 'Slides require an accessible owner export; only the source link has been imported.' : kind === 'recording' ? 'Recording transcript is not imported; source access and permission must be checked.' : 'Reference link retained; external content is not represented as imported.' });
    }
  }

  private addDocument(parsed: Parsed, config: { id: string; url: string; kind: string; approved: boolean; year?: string; revision?: string; license?: string; attribution?: string; archived?: boolean; expiresAt?: string }): KnowledgeDocument | undefined {
    if (!parsed.text.trim()) return undefined;
    if (Buffer.byteLength(parsed.text) > MAX_TEXT_BYTES) throw new Error('Extracted document exceeds the text limit');
    const usedOcr = parsed.extractionMethod === 'macos-vision-ocr';
    const approved = config.approved && !usedOcr;
    const attribution = [config.attribution, usedOcr ? 'Text extracted using macOS Vision OCR; verify formulae, diagrams and reading order against the original slides.' : undefined].filter(Boolean).join(' ');
    const imported: KnowledgeDocument = {
      id: config.id, title: parsed.title, text: parsed.text, sections: parsed.sections,
      type: config.kind, topics: topics(parsed.title, parsed.text), year: config.year,
      archived: config.archived ?? !!config.year,
      source: { url: config.url, status: approved ? 'approved' : 'review-required', revision: config.revision, attribution, license: config.license },
      ...(config.expiresAt ? { expiresAt: config.expiresAt } : {}),
      origin: 'imported',
    };
    const { document, redacted } = redactDocument(imported);
    document.importedContentHash = createHash('sha256').update(canonicalImportedContent(document)).digest('hex');
    this.documents.push(document);
    const reason = [redacted ? 'Credential-like text was redacted during import; verify the teaching example before use.' : undefined, parsed.extractionMethod ? `Extraction method: ${parsed.extractionMethod}.` : undefined, !approved ? usedOcr ? 'OCR accuracy and public redistribution rights require owner review.' : 'Content downloaded and parsed locally; public redistribution rights require owner review.' : undefined].filter(Boolean).join(' ');
    this.addSource({ url: config.url, title: parsed.title, kind: config.kind, status: approved ? 'imported' : 'review-required', revision: config.revision, year: config.year, license: config.license, attribution, documentIds: [document.id], ...(reason ? { reason } : {}) });
    return document;
  }

  private async cachedFetch(url: string, maxBytes = MAX_SOURCE_BYTES): Promise<Uint8Array> {
    const filename = path.join(this.rawDirectory, sourceId(url).replace(':', '-') + '.bin');
    const immutable = url.includes('raw.githubusercontent.com/') || url.includes('/git/trees/');
    if (this.options.offline || immutable) {
      try {
        const cachedStat = await stat(filename);
        if (cachedStat.size > maxBytes) throw new Error('Cached source exceeds the byte limit');
        this.fetchedAt.set(url, cachedStat.mtime.toISOString());
        return new Uint8Array(await readFile(filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || this.options.offline) throw error;
      }
    }
    const bytes = await fetchApproved(url, { maxBytes });
    await writeFile(filename + '.tmp', bytes, { mode: 0o600 });
    await rename(filename + '.tmp', filename);
    this.fetchedAt.set(url, new Date().toISOString());
    return bytes;
  }

  private async filesBelow(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) files.push(...await this.filesBelow(path.join(directory, entry.name)));
      else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) files.push(path.join(directory, entry.name));
    }
    return files.sort();
  }

  private async importPortal(): Promise<void> {
    try { this.revision = (await run('git', ['rev-parse', 'HEAD'], { cwd: this.options.repoRoot })).stdout.trim(); } catch { /* Source is still explicitly a working tree. */ }
    const localFiles = [...await this.filesBelow(path.join(this.options.repoRoot, 'our-initiatives')), ...await this.filesBelow(path.join(this.options.repoRoot, 'blog'))];
    for (const file of localFiles) {
      const relative = path.relative(this.options.repoRoot, file).split(path.sep).join('/');
      const safe = await containedPath(this.options.repoRoot, relative);
      if ((await stat(safe)).size > MAX_TEXT_BYTES) throw new Error('Portal file exceeds byte limit');
      const input = decodeText(await readFile(safe));
      const year = relative.match(/tutorials\/(\d{4})-(\d{4})/)?.slice(1).map((value, i) => i ? value.slice(-2) : value).join('/');
      const blog = relative.startsWith('blog/');
      const slug = blog ? input.match(/^slug:\s*(.+)$/m)?.[1] ?? path.basename(relative, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, '') : undefined;
      const route = blog ? `blog/${slug}` : relative.replace(/\.(md|mdx)$/i, '').replace(/\/index$/, '');
      const type = blog ? 'blog' : relative.includes('/tutorials/') ? 'tutorial-directory' : relative.includes('/journal-club/') ? 'journal-club' : 'research-pillar';
      this.recordLinks(input, year);
      this.addDocument(parseMarkdown(input, path.basename(file)), { id: docId('portal', relative), url: `https://uclai.co.uk/${encodedPath(route)}/`, kind: type, approved: true, archived: blog || relative.includes('/tutorials/') || relative.includes('/journal-club/'), year, revision: this.revision, attribution: 'UCL AI Society; original authors are named on the source page.' });
    }
    for (const [relative, route, title, kind] of PAGE_SOURCES) {
      const filename = await containedPath(this.options.repoRoot, relative);
      const text = decodeText(await readFile(filename), MAX_TEXT_BYTES);
      this.recordLinks(text);
      this.addDocument(parseReactCopy(text, title), { id: docId('portal', relative), url: `https://uclai.co.uk${route}`, kind, approved: true, revision: this.revision, attribution: 'UCL AI Society', archived: false });
    }
    // Footer links include the society's contact/community sources.
    this.recordLinks(decodeText(await readFile(await containedPath(this.options.repoRoot, 'docusaurus.config.js')), MAX_TEXT_BYTES));
    const relativePdf = 'static/jc/the_search_for_anonymous_data.pdf';
    const url = 'https://uclai.co.uk/jc/the_search_for_anonymous_data.pdf';
    try {
      const filename = await containedPath(this.options.repoRoot, relativePdf);
      const parsed = await extractPdf(filename, 'The search for anonymous data — Journal Club slides', { ocr: this.options.ocr, cacheDir: this.rawDirectory });
      this.addDocument(parsed, { id: docId('portal', relativePdf), url, kind: 'slides', approved: true, year: '2023/24', archived: true, revision: this.revision, attribution: 'Yves-Alexandre de Montjoye; UCL AI Society Journal Club, 9 October 2023' });
    } catch (error) { this.addSource({ url, title: 'The search for anonymous data — Journal Club slides', kind: 'slides', status: 'blocked', reason: message(error), year: '2023/24', documentIds: [] }); }
    this.progress(`Portal: ${this.documents.length} documents parsed.`);
  }

  private importSocietyFaqs(): void {
    this.addSource({ url: LUMA_FEED_URL, title: 'UCL AI Society public Luma calendar subscription', kind: 'events-calendar', status: 'link-only', documentIds: [], reason: 'Approved public subscription queried by list_events with separate retrieval time, expiry and source version; live event bodies are not stored in immutable knowledge releases.' });
    const membership = 'https://studentsunionucl.org/clubs-societies/artificial-intelligence-society';
    const nexusText = this.documents.filter(doc => doc.source.url === 'https://uclai.co.uk/our-initiatives/Nexus-Labs/').map(doc => doc.text).join('\n');
    const tutorialText = this.documents.find(doc => doc.source.url === 'https://uclai.co.uk/our-initiatives/tutorials/')?.text ?? '';
    const nexusClosed = /Nexus Labs 2026\/27/.test(nexusText) && /Applications now closed\./.test(nexusText);
    const tutorialArchive = /2026\/27 tutorial materials are not published here/.test(tutorialText) && /2023\/24 and 2024\/25/.test(tutorialText);
    const aboutText = this.documents.find(doc => doc.source.url === 'https://uclai.co.uk/about-us/' && doc.type === 'society')?.text ?? '';
    const faqs = [
      {
        id: 'faq:society-values',
        evidencePresent: aboutText.includes('Never Build for Lethality') && aboutText.includes('No AI Slop'),
        title: 'What does UCL AI Society stand for? Our values and principles',
        text: `${publicGuidance.values.summary}\n\nThe eight principles are: Never Build for Lethality; Never Use AI to Impersonate a Human; Defend Human Creativity; Welcome Every Student; Ask Anything, Help Anyone; Build, Don’t Regurgitate; Question the Hype; No AI Slop.\n\nRead the full statement: ${publicGuidance.values.url}`,
        url: 'https://uclai.co.uk/about-us/',
      },
      {
        id: 'faq:knowledge-help',
        evidencePresent: true,
        title: 'What if the AI cannot answer my question? Accuracy disclaimer and committee contact',
        text: `${publicGuidance.disclaimer}\n\nIf the approved records cannot answer your question, are conflicting, missing or out of date, or your question falls outside the library or needs committee guidance, email ${publicGuidance.contact.email}. The assistant should explain what it cannot establish and direct you to that address rather than inventing an answer or society policy.\n\n${publicGuidance.values.summary}\nSociety principles: ${publicGuidance.values.url}`,
        url: 'https://uclai.co.uk/connect/',
      },
      {
        id: 'faq:society-membership',
        evidencePresent: this.sources.has(sourceId(membership)),
        title: 'How do I join UCL AI Society? Society membership',
        text: `Join UCL AI Society through the official Students’ Union UCL membership page: ${membership}\n\nThe society website’s Join us link leads to that membership page. This portal snapshot does not establish membership prices or membership eligibility; check the official membership page for those details.`,
        url: 'https://uclai.co.uk/about-us/',
      },
      {
        id: 'faq:get-involved',
        evidencePresent: nexusClosed,
        title: 'How can I get involved with UCL AI Society?',
        text: 'The society’s current initiatives are Nexus Labs student research, the AgentVerse student AI hackathon, and events and career opportunities through society partnerships. Nexus Labs student applications for 2026/27 are currently closed. The initiatives page also links to archived machine learning tutorials and Journal Club materials for self-study.\n\nExplore the initiatives: https://uclai.co.uk/our-initiatives/\nAgentVerse: https://agentverse.uclai.co.uk/\nEvents and opportunities: https://uclai.co.uk/our-initiatives/opportunities/\nStartup scheme and LICA are labelled Coming soon; do not describe them as launched programmes.',
        url: 'https://uclai.co.uk/our-initiatives/',
      },
      {
        id: 'faq:nexus-applications',
        evidencePresent: nexusClosed,
        title: 'Are Nexus Labs 2026/27 student applications open or closed?',
        text: 'Nexus Labs 2026/27 student applications are now closed, according to the current Nexus Labs page.\n\nNexus Labs is UCL AI Society’s research division. It helps students find teams, develop research and present their work, across Advanced and Exploratory tracks. The page separately links to Pillar Officer and academic mentor registration routes. Those links do not establish that student applications have reopened.\n\nCurrent programme information: https://uclai.co.uk/our-initiatives/Nexus-Labs/',
        url: 'https://uclai.co.uk/our-initiatives/Nexus-Labs/',
      },
      {
        id: 'faq:events-calendar',
        evidencePresent: this.sources.has(sourceId('https://luma.com/UCLAISociety')),
        title: 'Where can I find UCL AI Society events, talks, workshops and calendar?',
        text: 'The official society and partner events calendar is on Luma: https://luma.com/UCLAISociety\n\nThe society website embeds that calendar on its Events and opportunities page: https://uclai.co.uk/our-initiatives/opportunities/\n\nUse the list_events tool for upcoming events from the approved public Luma subscription. It reports retrieval time, expiry and source links, and keeps current events separate from archived tutorials. If the feed is unavailable, do not infer that no events exist; check the Luma calendar or email info@uclai.co.uk. Always confirm registration and final details on the linked event page. Live calendar data has its own source version and is separate from this knowledge release.',
        url: 'https://uclai.co.uk/our-initiatives/opportunities/',
      },
      {
        id: 'faq:tutorial-archive',
        evidencePresent: tutorialArchive,
        title: 'Where are UCL AI Society tutorials, notebooks and slides? Are 2026/27 tutorials published?',
        text: 'The website provides an archive of machine learning tutorial notebooks, slides and recordings from 2023/24 and 2024/25, available for self-study: https://uclai.co.uk/our-initiatives/tutorials/\n\nThe archive explicitly says 2026/27 tutorial materials are not published there. The archived session dates are historical and are not a current timetable or an invitation to an upcoming session. Earlier 2020/21, 2021/22 and 2022/23 series are linked through their GitHub repositories. Some old links may no longer be maintained.',
        url: 'https://uclai.co.uk/our-initiatives/tutorials/',
      },
    ];
    for (const faq of faqs) {
      if (!faq.evidencePresent) {
        const id = `knowledge-gap:${faq.id}`;
        this.sources.set(id, { id, url: faq.url, title: faq.title, kind: 'knowledge-gap', status: 'missing', reason: 'The factual FAQ template no longer matches the imported portal evidence. Update the answer before publication.', documentIds: [] });
        continue;
      }
      const doc = this.addDocument({ title: faq.title, text: faq.text, sections: [{ id: 'answer', heading: faq.title, text: faq.text, kind: 'explanation' }] }, { id: faq.id, url: faq.url, kind: 'faq', approved: true, archived: false, revision: this.revision, attribution: 'UCL AI Society; factual FAQ compiled from the current linked portal page.' });
      if (doc) doc.reviewedAt = new Date().toISOString();
    }
    for (const [id, title, reason] of [
      ['membership-price', 'What does UCL AI Society membership cost?', 'The current portal links to the official membership page but does not contain a verified membership price. Do not infer a price from older blog posts or hackathon FAQs.'],
      ['membership-eligibility', 'Who is eligible for UCL AI Society membership?', 'The current portal does not establish a complete membership eligibility policy. Hackathon participation and membership eligibility are different questions; consult the official Students’ Union membership page.'],
    ]) {
      const idValue = `knowledge-gap:${id}`;
      this.sources.set(idValue, { id: idValue, url: membership, title, kind: 'knowledge-gap', status: 'missing', reason, documentIds: [] });
    }
  }

  private async importTeachingRepository(repo: typeof TEACHING_REPOSITORIES[number]): Promise<void> {
    const rootUrl = `https://github.com/UCLAIS/${repo.name}`;
    try {
      const commit = JSON.parse(decodeText(await this.cachedFetch(`https://api.github.com/repos/UCLAIS/${repo.name}/commits/${repo.branch}`, MAX_TEXT_BYTES)));
      if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid GitHub commit metadata');
      const revision: string = commit.sha;
      const tree = JSON.parse(decodeText(await this.cachedFetch(`https://api.github.com/repos/UCLAIS/${repo.name}/git/trees/${revision}?recursive=1`, MAX_TEXT_BYTES)));
      if (!Array.isArray(tree.tree) || tree.truncated || tree.tree.length > 20_000) throw new Error('Incomplete or oversized repository tree');
      const entries: Entry[] = tree.tree.filter((entry: Entry) => entry.type === 'blob');
      const makeRawUrl = (relative: string) => `https://raw.githubusercontent.com/UCLAIS/${repo.name}/${revision}/${encodedPath(validateRepositoryPath(relative))}`;
      let license: string | undefined;
      const licenseEntry = entries.find(entry => /^licen[cs]e(?:\.md|\.txt)?$/i.test(entry.path));
      if (licenseEntry) {
        const value = decodeText(await this.cachedFetch(makeRawUrl(licenseEntry.path), 256 * 1024));
        if (/^MIT License/m.test(value) && /Permission is hereby granted/.test(value)) license = 'MIT';
      }
      const credit = repo.name === 'ml-tutorials-season-5' ? 'UCL AI Society. week-10 is based on Andrej Karpathy, karpathy/ng-video-lecture; retain original attribution.' : 'UCL AI Society and credited tutorial authors';
      const approved = license === 'MIT';
      const importedIds: string[] = [];
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < entries.length) {
          const entry = entries[nextIndex++];
          let url = rootUrl;
          try {
            validateRepositoryPath(entry.path);
            url = `${rootUrl}/blob/${revision}/${encodedPath(entry.path)}`;
            if (entry.mode === '120000') throw new Error('Repository symlink refused');
            if (!/\.(ipynb|pdf|md|py)$/i.test(entry.path)) {
              if (/\.(csv|txt|png|jpe?g|gif|svg)$/i.test(entry.path) && !/licen[cs]e/i.test(entry.path)) this.addSource({ url, title: entry.path, kind: 'attachment', status: 'link-only', reason: 'Dataset or image attachment retained by reference; not indexed as teaching prose.', revision, year: repo.year, license, attribution: credit, documentIds: [] });
              continue;
            }
            const maxBytes = entry.path.toLowerCase().endsWith('.pdf') ? MAX_PDF_BYTES : MAX_SOURCE_BYTES;
            if (!Number.isSafeInteger(entry.size) || entry.size! > maxBytes) throw new Error('Source exceeds the byte limit');
            const bytes = await this.cachedFetch(makeRawUrl(entry.path), maxBytes);
            if (bytes.length !== entry.size) throw new Error('Source size changed from pinned GitHub tree');
            // Verify Git's blob hash, not just the HTTP response status.
            const actualSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
            if (actualSha !== entry.sha) throw new Error('Source hash disagrees with pinned GitHub tree');
            let parsed: Parsed; let kind: string;
            if (entry.path.endsWith('.ipynb')) { const notebook = parseNotebook(decodeText(bytes), path.basename(entry.path)); parsed = notebook; kind = notebook.type; }
            else if (entry.path.endsWith('.pdf')) { parsed = await extractPdf(path.join(this.rawDirectory, sourceId(makeRawUrl(entry.path)).replace(':', '-') + '.bin'), path.basename(entry.path, '.pdf'), { ocr: this.options.ocr, cacheDir: this.rawDirectory }); kind = 'slides'; }
            else if (entry.path.endsWith('.py')) { const code = decodeText(bytes); parsed = { title: path.basename(entry.path), text: `\`\`\`python\n${code}\n\`\`\``, sections: [{ id: 'code', heading: path.basename(entry.path), text: code, kind: 'code' }] }; kind = 'teaching-code'; }
            else { const input = decodeText(bytes); parsed = parseMarkdown(input, path.basename(entry.path)); kind = 'tutorial-guide'; this.recordLinks(input, repo.year); }
            const doc = this.addDocument(parsed, { id: docId('teaching', `${repo.name}/${entry.path}`), url, kind, approved, revision, license, year: repo.year, attribution: credit, archived: true });
            if (doc) importedIds.push(doc.id);
          } catch (error) { this.addSource({ url, title: entry.path, kind: path.extname(entry.path).slice(1) || 'source', status: 'blocked', reason: message(error), revision, year: repo.year, license, attribution: credit, documentIds: [] }); }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      this.addSource({ url: rootUrl, title: `${repo.name} (${repo.year})`, kind: 'tutorial-repository', status: approved ? 'imported' : 'review-required', reason: approved ? undefined : 'No recognised repository licence found. Parsed bodies remain outside the public corpus pending owner review.', revision, year: repo.year, license, attribution: credit, documentIds: importedIds });
      // Direct portal URLs often point at a folder or main/master. Link them to
      // the actual pinned imported records, preserving the original URL as well.
      for (const record of [...this.sources.values()]) {
        if (!record.url.startsWith(rootUrl + '/')) continue;
        const remainder = new URL(record.url).pathname.slice(`/UCLAIS/${repo.name}/`.length);
        const match = remainder.match(/^(blob|tree)\/(main|master)\/(.+)$/);
        if (!match) continue;
        const target = decodeURIComponent(match[3]);
        const docs = this.documents.filter(doc => importedIds.includes(doc.id) && (match[1] === 'blob' ? doc.source.url.endsWith('/' + encodedPath(target)) : doc.source.url.includes('/' + encodedPath(target) + '/')));
        if (docs.length) this.addSource({ ...record, status: approved ? 'imported' : 'review-required', revision, license, attribution: credit, documentIds: docs.map(doc => doc.id), reason: approved ? undefined : 'Content parsed locally; public redistribution rights need review.' });
      }
      this.progress(`${repo.name}: ${importedIds.length} documents parsed (${approved ? 'MIT' : 'rights review needed'}).`);
    } catch (error) {
      this.addSource({ url: rootUrl, title: repo.name, kind: 'tutorial-repository', status: 'blocked', reason: message(error), year: repo.year, documentIds: [] });
      this.progress(`${repo.name}: blocked: ${message(error)}`);
    }
  }

  private async importAgentverse(): Promise<void> {
    const url = 'https://agentverse.uclai.co.uk/';
    try {
      const input = decodeText(await this.cachedFetch(url, 2 * 1024 * 1024));
      const parsed = parseHtmlCopy(input, 'AgentVerse — FAQs, tracks and event information');
      // A one-day freshness window avoids preserving open applications forever.
      const expiresAt = new Date(new Date(this.fetchedAt.get(url)!).getTime() + 24 * 60 * 60 * 1000).toISOString();
      this.addDocument(parsed, { id: 'society:agentverse', url, kind: 'event', approved: true, archived: false, attribution: 'UCL AI Society AgentVerse organisers', expiresAt });
      this.recordLinks(input);
    } catch (error) { this.addSource({ url, title: 'AgentVerse', kind: 'event', status: 'blocked', documentIds: [], reason: message(error) }); }
  }

  private learningPaths(): LearningPath[] {
    const docs = this.documents.filter(doc => doc.source.status === 'approved' && doc.year === '2024/25');
    const suffixes = ['week-1/1_1_introduction_to_python.ipynb', 'week-1/1_2_python_exercises.ipynb', 'week-1/2_1_scientific_computing_libraries.ipynb', 'week-2/linear_regression_exercise.ipynb', 'week-3/exercises/p1_logistic_regression_exercise.ipynb', 'week-5/neural_networks.ipynb'];
    const steps = suffixes.flatMap(suffix => {
      const doc = docs.find(doc => doc.source.url.endsWith('/' + encodedPath(suffix)));
      return doc ? [{ documentId: doc.id, note: 'Archived 2024/25 self-study material; check library versions before running code locally.' }] : [];
    });
    return steps.length ? [{ id: 'python-to-introductory-ml', title: 'Python to introductory machine learning', description: 'A curated self-study route through archived society notebooks, from Python to regression, classification and neural networks.', prerequisites: ['Basic familiarity with using a computer. A local or hosted notebook environment is needed only if you choose to run exercises.'], steps }] : [];
  }

  async import(): Promise<Corpus> {
    await mkdir(this.rawDirectory, { recursive: true, mode: 0o700 });
    await this.importPortal();
    this.importSocietyFaqs();
    for (const repo of TEACHING_REPOSITORIES) await this.importTeachingRepository(repo);
    await this.importAgentverse();
    return { schemaVersion: 1, generatedAt: new Date().toISOString(), documents: this.documents.sort((a, b) => a.id.localeCompare(b.id)), sources: [...this.sources.values()].sort((a, b) => a.id.localeCompare(b.id)), learningPaths: this.learningPaths() };
  }
}

export function publicCorpus(corpus: Corpus): Corpus {
  const documents = corpus.documents.filter(doc => doc.source.status === 'approved');
  const ids = new Set(documents.map(doc => doc.id));
  return { ...corpus, documents, sources: corpus.sources.map(source => ({ ...source, documentIds: source.documentIds.filter(id => ids.has(id)) })), learningPaths: corpus.learningPaths.map(item => ({ ...item, steps: item.steps.filter(step => ids.has(step.documentId)) })).filter(item => item.steps.length) };
}

export async function writeImportResults(corpus: Corpus, directory: string): Promise<{ documents: number; publicDocuments: number; sourceStatuses: Record<string, number> }> {
  await mkdir(directory, { recursive: true });
  const atomicWrite = async (name: string, content: string, mode = 0o644) => {
    const target = path.join(directory, name);
    await writeFile(target + '.tmp', content, { mode });
    await rename(target + '.tmp', target);
  };
  const publicSnapshot = publicCorpus(corpus);
  const sourceStatuses: Record<string, number> = {};
  for (const source of corpus.sources) sourceStatuses[source.status] = (sourceStatuses[source.status] ?? 0) + 1;
  const summary = { documents: corpus.documents.length, publicDocuments: publicSnapshot.documents.length, sourceStatuses };
  const inventory = { schemaVersion: 1, generatedAt: corpus.generatedAt, summary, sources: corpus.sources };
  await atomicWrite('corpus.json', JSON.stringify(corpus, null, 2) + '\n', 0o600);
  await atomicWrite('bootstrap-corpus.json', JSON.stringify(publicSnapshot, null, 2) + '\n');
  await atomicWrite('inventory.json', JSON.stringify(inventory, null, 2) + '\n');
  const gaps = corpus.sources.filter(source => ['blocked', 'missing', 'review-required'].includes(source.status));
  const report = [
    '# Knowledge import inventory', '', `Generated: ${corpus.generatedAt}`, '',
    `Parsed documents: ${summary.documents}. Publicly approved documents: ${summary.publicDocuments}.`, '',
    '| Source status | Count |', '| --- | ---: |', ...Object.entries(sourceStatuses).map(([key, count]) => `| ${key} | ${count} |`), '',
    'The inventory counts source URLs, including aliases and parent repository links. It is not a count of unique teaching lessons.', '',
    'Raw downloaded files and the comprehensive local corpus are ignored by Git. The bootstrap corpus contains approved bodies only. Repository MIT notices are preserved in document attribution and the licence appendix below. Unlicensed sources remain review-required. Notebook outputs are discarded and code is never executed.', '',
    '## Import gaps and rights review', '', ...gaps.map(source => `- [${source.title.replace(/[\[\]\n]/g, ' ')}](${source.url}): **${source.status}**. ${source.reason ?? ''}`), '',
    '## Slide and recording coverage', '', 'Canva slide links and recording URLs are retained as links. Their bodies and transcripts are not claimed as imported. Owner-exported PDFs or authorised transcripts can be added through the publishing workflow.', '',
    '## Licence notice for MIT tutorial sources', '',
    'MIT License', '', 'Copyright (c) 2021 UCL Artificial Intelligence Society (Seasons 1 and 2)', 'Copyright (c) 2024 UCL Artificial Intelligence Society (Season 5)', '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:', '',
    'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.', '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.', '',
  ].join('\n');
  await atomicWrite('inventory.md', report);
  return summary;
}
