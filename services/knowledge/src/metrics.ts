export type MetricService = 'auth' | 'admin';
export type MetricOutcome = 'auth_failure' | 'import_failure' | 'publication_success' | 'publication_failure' | 'request_error' | 'request_success';
export interface OperationMetric { hour: string; service: MetricService; outcome: MetricOutcome; count: number }

const SERVICES = new Set<MetricService>(['auth', 'admin']);
const OUTCOMES = new Set<MetricOutcome>(['auth_failure', 'import_failure', 'publication_success', 'publication_failure', 'request_error', 'request_success']);
const HOUR = 3600;
const currentHour = () => Math.floor(Date.now() / (HOUR * 1000)) * HOUR;
// The current UTC hour and 167 preceding buckets contain no data older than seven days.
const firstRetainedHour = () => currentHour() - (7 * 24 - 1) * HOUR;

/** Fixed dimensions only. No caller-supplied identifiers or content are stored. */
export async function recordMetric(db: D1Database, service: MetricService, outcome: MetricOutcome): Promise<void> {
  if (!SERVICES.has(service) || !OUTCOMES.has(outcome)) throw new TypeError('Invalid operations metric');
  await db.prepare('INSERT INTO operation_metrics(hour,service,outcome,count) VALUES(?,?,?,1) ON CONFLICT(hour,service,outcome) DO UPDATE SET count=count+1').bind(currentHour(), service, outcome).run();
}

/** Read the rolling 168-hour aggregate, including the in-progress UTC hour. */
export async function readMetrics(db: D1Database): Promise<OperationMetric[]> {
  const rows = await db.prepare('SELECT hour,service,outcome,count FROM operation_metrics WHERE hour>=? AND hour<=? ORDER BY hour,service,outcome').bind(firstRetainedHour(), currentHour()).all<{ hour: number; service: MetricService; outcome: MetricOutcome; count: number }>();
  return rows.results.map(row => ({ hour: new Date(row.hour * 1000).toISOString(), service: row.service, outcome: row.outcome, count: row.count }));
}

/** Called by maintenance; callers must keep metrics failures from affecting user actions. */
export async function pruneMetrics(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM operation_metrics WHERE hour<?').bind(firstRetainedHour()).run();
}
