import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server';

/** Official modern and stateless legacy transports share exactly the same tool factory. */
export async function handleMcp(request: Request, server: McpServer, maxRequestBodySize = 2_500_000): Promise<Response> {
  const handler = createMcpHandler(() => server, { legacy: 'stateless', responseMode: 'json', maxRequestBodySize, maxSubscriptions: 0 });
  return handler.fetch(request);
}
