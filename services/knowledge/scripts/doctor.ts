import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface DiagnosticReport { target: 'public' | 'editor'; endpoint: string; ok: boolean; checks: string[]; error?: string }
const PUBLIC_TOOLS = ['search', 'fetch', 'list_learning_paths', 'get_learning_path', 'list_events'];

export function parseEndpoint(input: string): URL {
  const url = new URL(input);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS MCP endpoint without credentials, a query or a fragment. HTTP is allowed only on loopback.');
  }
  return url;
}

/** Makes only initialize, tools/list and (for public access) one read-only search call. */
export async function diagnose(input: string, target: 'public' | 'editor', token?: string): Promise<DiagnosticReport> {
  const url = parseEndpoint(input);
  const report: DiagnosticReport = { target, endpoint: url.href, ok: false, checks: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const client = new Client({ name: 'uclai-connection-doctor', version: '0.1.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(url, {
    ...(token ? { authProvider: { token: async () => token } } : {}),
    requestInit: { redirect: 'error' },
    fetch: async (request, init) => fetch(request, { ...init, signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]) }),
  });
  try {
    await client.connect(transport);
    report.checks.push('MCP initialisation completed using the official SDK.');
    const toolNames = new Map<string, boolean>();
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const result = await client.listTools(cursor ? { cursor } : {});
      for (const tool of result.tools) toolNames.set(tool.name, tool.annotations?.readOnlyHint === true);
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    if (cursor) throw new Error('too_many_tool_pages');
    if (target === 'public') {
      if (PUBLIC_TOOLS.some(name => !toolNames.has(name)) || [...toolNames.keys()].some(name => !PUBLIC_TOOLS.includes(name))) throw new Error('unexpected_public_tools');
      if ([...toolNames.values()].some(readOnly => !readOnly)) throw new Error('public_tool_not_read_only');
      report.checks.push('All five expected public tools are available and annotated read-only.');
      const search = await client.callTool({ name: 'search', arguments: { query: 'membership' } });
      if (search.isError) throw new Error('search_failed');
      report.checks.push('A public search completed. No result text or raw query is logged.');
    } else {
      if (!toolNames.size || [...toolNames.keys()].some(name => /^(publish|rollback|withdraw|set_role|assign_role|revoke_role)(_|$)/.test(name))) throw new Error('unexpected_editor_tools');
      report.checks.push('Authenticated editor tools are discoverable. No draft or write tool was called.');
    }
    report.ok = true;
  } catch {
    // SDK errors may contain response bodies, headers or URLs. Never print them.
    report.error = controller.signal.aborted ? 'Connection timed out.' : 'Connection check failed. Verify endpoint, current release, network access and, for editor access, token audience, expiry and maintainer role.';
  } finally {
    clearTimeout(timeout);
    controller.abort();
    await client.close().catch(() => {});
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Read-only MCP diagnostics.\n  pnpm run doctor --url https://PUBLIC_HOST/mcp\n  pnpm run doctor --editor-url https://EDITOR_HOST/mcp\nOr set KNOWLEDGE_PUBLIC_MCP_URL / KNOWLEDGE_EDITOR_MCP_URL.\nOptional editor bearer token: KNOWLEDGE_EDITOR_ACCESS_TOKEN (never printed).');
    return;
  }
  const value = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
  const publicUrl = value('--url') || process.env.KNOWLEDGE_PUBLIC_MCP_URL;
  const editorUrl = value('--editor-url') || process.env.KNOWLEDGE_EDITOR_MCP_URL;
  if (!publicUrl && !editorUrl) throw new Error('Set KNOWLEDGE_PUBLIC_MCP_URL or pass --url. Use --help for details.');
  const reports: DiagnosticReport[] = [];
  if (publicUrl) reports.push(await diagnose(publicUrl, 'public'));
  if (editorUrl) reports.push(await diagnose(editorUrl, 'editor', process.env.KNOWLEDGE_EDITOR_ACCESS_TOKEN));
  console.log(JSON.stringify({ reports, clientVerification: 'SDK diagnostics do not establish ChatGPT or Claude product compatibility. Complete the manual client acceptance checks.' }, null, 2));
  if (reports.some(report => !report.ok)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Diagnostic configuration failed. Use --help and provide a valid endpoint without embedded credentials. No credential or remote response was logged.');
    process.exitCode = 1;
  });
}
