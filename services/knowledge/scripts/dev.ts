import { startPublicDev } from './local-public';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Loopback-only public HTTP/MCP development server.\n  pnpm dev [--port 8787] [--corpus data/bootstrap-corpus.json]\nDefault: approved bootstrap plus the GitHub knowledge folder. Custom --corpus: approved corpus only. No editor or remote publication.');
} else {
  const value = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
  const rawPort = value('--port');
  startPublicDev({ ...(rawPort ? { port: Number(rawPort) } : {}), ...(value('--corpus') ? { corpusFile: value('--corpus') } : {}) }).then(server => {
    const address = server.address();
    const port = address && typeof address !== 'string' ? address.port : 8787;
    console.log(`Local public MCP: http://127.0.0.1:${port}/mcp\nApproved local snapshot only. This is not a deployed release or an authenticated editor.\nRun pnpm run doctor --url http://127.0.0.1:${port}/mcp in another terminal.`);
    const stop = () => server.close(() => process.exit(0));
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }).catch(() => {
    console.error('Local server could not start. Check the knowledge folder, approved corpus and port, then retry. No imported content or credentials were logged.');
    process.exitCode = 1;
  });
}
