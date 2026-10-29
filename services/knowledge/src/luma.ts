import type { KnowledgeDocument } from './types';
import { sha256 } from './storage';
import { redactSensitiveText } from './content-safety';

export const LUMA_CALENDAR_URL = 'https://luma.com/UCLAISociety';
export const LUMA_FEED_URL = 'https://api.lu.ma/ics/get?entity=calendar&id=cal-3vytj1DeqX8k7mk';
const BYTE_LIMIT = 1024 * 1024;
const TTL_SECONDS = 12 * 60 * 60; // The public Luma export advertises PT12H.
const CACHE_KEY = 'https://uclai-calendar-cache.invalid/public-luma-v1';
type CalendarEvent = KnowledgeDocument & { calendarStatus: 'tentative' | 'confirmed'; allDay: boolean };
type Snapshot = { schemaVersion: 1; sourceVersion: string; fetchedAt: string; expiresAt: string; exportedCount: number; skippedCount: number; events: CalendarEvent[] };
type EdgeCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };

function safeUrl(value: string | undefined): string | undefined {
  if (!value || value.length > 2048) return;
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch { /* Inert text, never a fetch target. */ }
}
const unescapeText = (value: string) => value.replace(/\\([nN,;\\])/g, (_, escape: string) => /n/i.test(escape) ? '\n' : escape).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
function date(value: string | undefined): { iso: string; allDay: boolean } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/);
  if (!match) return null; // Floating times/recurrences need explicit support, never an assumed timezone.
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? '00'}:${match[5] ?? '00'}:${match[6] ?? '00'}.000Z`;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === iso ? { iso, allDay: !match[4] } : null;
}

/** Passive subset of the published Luma iCalendar export. No URLs or components execute. */
export function parseLumaFeed(input: string, fetchedAt: string, sourceVersion: string): Omit<Snapshot, 'schemaVersion'> {
  if (new TextEncoder().encode(input).length > BYTE_LIMIT || !input.startsWith('BEGIN:VCALENDAR') || !/END:VCALENDAR\s*$/.test(input)) throw new Error('Invalid calendar export');
  const lines = input.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  if (lines.length > 50_000 || lines.some(line => line.length > 32_768)) throw new Error('Calendar exceeds limits');
  const selected = new Map<string, { fields: Map<string, string>; invalid: boolean; sequence: number }>();
  let fields: Map<string, string> | null = null; let invalid = false; let depth = 0; let exportedCount = 0; let skippedCount = 0;
  const keep = new Set(['UID', 'SUMMARY', 'DESCRIPTION', 'LOCATION', 'URL', 'DTSTART', 'DTEND', 'STATUS', 'SEQUENCE']);
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (fields) throw new Error('Nested event refused'); fields = new Map(); invalid = false; depth = 0; if (++exportedCount > 2000) throw new Error('Too many calendar events'); continue; }
    if (!fields) continue;
    if (line === 'END:VEVENT') {
      const uid = fields.get('UID');
      if (!uid || !/^[A-Za-z0-9_-]{1,100}@events\.(?:lu\.ma|luma\.com)$/.test(uid)) skippedCount++;
      else {
        const sequence = Number(fields.get('SEQUENCE') ?? 0);
        if (!Number.isSafeInteger(sequence) || sequence < 0) invalid = true;
        const old = selected.get(uid);
        if (!old || sequence >= old.sequence) selected.set(uid, { fields, invalid, sequence });
      }
      fields = null; continue;
    }
    if (line.startsWith('BEGIN:')) { if (++depth > 8) throw new Error('Nested calendar exceeds limits'); continue; }
    if (line.startsWith('END:')) { if (--depth < 0) throw new Error('Unbalanced calendar'); continue; }
    if (depth) continue; // Alarms, attachments and nested components are ignored.
    const separator = line.indexOf(':'); if (separator < 1) continue;
    const header = line.slice(0, separator); const name = header.split(';')[0].toUpperCase();
    if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].includes(name)) invalid = true;
    if (!keep.has(name)) continue; // Includes ATTENDEE and ORGANIZER: no guest/account records are retained.
    if (fields.has(name) || (['DTSTART', 'DTEND'].includes(name) && /TZID=/i.test(header))) invalid = true;
    fields.set(name, redactSensitiveText(unescapeText(line.slice(separator + 1))));
  }
  if (fields) throw new Error('Truncated calendar event');
  const expiresAt = new Date(Date.parse(fetchedAt) + TTL_SECONDS * 1000).toISOString();
  const events: CalendarEvent[] = [];
  for (const [uid, entry] of selected) {
    const value = entry.fields;
    if (value.get('STATUS') === 'CANCELLED') continue;
    const start = date(value.get('DTSTART')); const end = date(value.get('DTEND'));
    const title = value.get('SUMMARY');
    if (entry.invalid || !start || !title || title.length > 500 || (value.has('DTEND') && (!end || end.iso <= start.iso))) { skippedCount++; continue; }
    const description = (value.get('DESCRIPTION') ?? '').slice(0, 8000);
    const location = (value.get('LOCATION') ?? '').slice(0, 2000);
    const descriptionUrl = description.match(/https:\/\/(?:luma\.com|lu\.ma)\/[^\s<>"']+/)?.[0];
    const specificDescriptionUrl = descriptionUrl && safeUrl(descriptionUrl) !== LUMA_CALENDAR_URL ? safeUrl(descriptionUrl) : undefined;
    const registrationUrl = safeUrl(value.get('URL')) ?? specificDescriptionUrl ?? safeUrl(location) ?? (uid.startsWith('evt-') ? `https://luma.com/event/${uid.split('@')[0]}` : LUMA_CALENDAR_URL);
    events.push({
      id: `luma:${uid.split('@')[0]}`, title, type: 'event', archived: false, topics: ['society', 'events'],
      text: `${title}\n${description}${location ? `\nLocation: ${location}` : ''}`,
      source: { url: registrationUrl, revision: sourceVersion, attribution: 'UCL AI Society public Luma calendar; event organisers retain their attribution.', status: 'approved' },
      event: { start: start.iso, ...(end ? { end: end.iso } : {}), timezone: 'UTC', registrationUrl },
      expiresAt, calendarStatus: value.get('STATUS') === 'CONFIRMED' ? 'confirmed' : 'tentative', allDay: start.allDay,
    });
  }
  return { sourceVersion, fetchedAt, expiresAt, exportedCount, skippedCount, events };
}

/** Public calendar only: no API key, arbitrary URL input, guest lists or write operations. */
export class LumaCalendar {
  private snapshot?: Snapshot;
  private pending?: Promise<Snapshot>;
  private failedUntil = 0;
  constructor(private network: typeof fetch = fetch, private cache?: EdgeCache) {}

  private async load(now: Date): Promise<Snapshot> {
    if (this.snapshot && Date.parse(this.snapshot.expiresAt) > now.getTime()) return this.snapshot;
    if (this.failedUntil > now.getTime()) throw new Error('Calendar temporarily unavailable');
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        const cached = await this.cache?.match(new Request(CACHE_KEY)).catch(() => undefined);
        if (cached) {
          const parsed = await cached.json() as Snapshot;
          if (parsed.schemaVersion === 1 && Date.parse(parsed.expiresAt) > now.getTime() && Array.isArray(parsed.events)) { this.snapshot = parsed; return parsed; }
        }
        const network = this.network; // Workers' global fetch must not receive this class as its receiver.
        const response = await network(LUMA_FEED_URL, { redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/calendar', 'User-Agent': 'UCLAIS-Knowledge-Calendar/1.0' } });
        if (response.status !== 200 || !/^text\/calendar(?:;|$)/i.test(response.headers.get('Content-Type') ?? '')) { await response.body?.cancel(); throw new Error('Calendar feed unavailable'); }
        if (Number(response.headers.get('Content-Length')) > BYTE_LIMIT || !response.body) { await response.body?.cancel(); throw new Error('Calendar exceeds limit'); }
        const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
        try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > BYTE_LIMIT) throw new Error('Calendar exceeds limit'); chunks.push(value); } }
        catch (error) { await reader.cancel(); throw error; } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const snapshot: Snapshot = { schemaVersion: 1, ...parseLumaFeed(text, now.toISOString(), await sha256(text)) };
        this.snapshot = snapshot;
        await this.cache?.put(new Request(CACHE_KEY), Response.json(snapshot, { headers: { 'Cache-Control': `public, max-age=${TTL_SECONDS}` } })).catch(() => {});
        return snapshot;
      } catch { this.failedUntil = now.getTime() + 60_000; throw new Error('Calendar unavailable; check Luma or email info@uclai.co.uk.'); }
    })();
    try { return await this.pending; } finally { this.pending = undefined; }
  }

  async listEvents(now = new Date()) {
    const source = { sourceUrl: LUMA_CALENDAR_URL, feedUrl: LUMA_FEED_URL, refreshIntervalSeconds: TTL_SECONDS };
    try {
      const snapshot = await this.load(now);
      const events = snapshot.events.filter(event => Date.parse(event.event!.end ?? event.event!.start) > now.getTime()).sort((a, b) => a.event!.start.localeCompare(b.event!.start));
      return { events, calendar: { ...source, status: 'available' as const, sourceVersion: snapshot.sourceVersion, fetchedAt: snapshot.fetchedAt, expiresAt: snapshot.expiresAt, exportedCount: snapshot.exportedCount, skippedCount: snapshot.skippedCount, ...(snapshot.skippedCount ? { warning: 'Some calendar entries could not be interpreted. This is partial coverage; check Luma or email info@uclai.co.uk before concluding no events exist.' } : {}), coverage: 'Published calendar export only; check the linked event page for current registration and final details.' } };
    } catch {
      return { events: [] as CalendarEvent[], calendar: { ...source, status: 'unavailable' as const, checkedAt: now.toISOString(), warning: 'Upcoming Luma events could not be verified. Do not interpret this as no upcoming events. Check the calendar or email info@uclai.co.uk.' } };
    }
  }
}
