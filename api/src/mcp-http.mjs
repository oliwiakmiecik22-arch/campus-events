import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp.mjs';

function authorizeRequest(header, authToken) {
  const supplied = /^Bearer (.+)$/i.exec(header || '')?.[1];
  if (!supplied || !authToken) return false;
  const suppliedBytes = Buffer.from(supplied);
  const tokenBytes = Buffer.from(authToken);
  return suppliedBytes.length === tokenBytes.length && timingSafeEqual(suppliedBytes, tokenBytes);
}

export function registerMcpHttpRoute(app, dependencies, authToken) {
  app.use('/mcp', (req, res, next) => {
    if (!authToken) {
      return res.status(503).json({
        error: { code: 'NOT_CONFIGURED', message: 'Remote MCP access is not configured' }
      });
    }
    if (!authorizeRequest(req.get('authorization'), authToken)) {
      res.set('WWW-Authenticate', 'Bearer realm="campus-events-mcp"');
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required' } });
    }
    next();
  });

  app.post('/mcp', async (req, res) => {
    const server = createMcpServer(dependencies);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (err) {
      console.error('MCP HTTP request failed', { message: err.message });
      if (!res.headersSent) {
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'MCP request failed' } });
      }
      void transport.close();
      void server.close();
    }
  });

  app.get('/mcp', (_req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for stateless MCP requests' } }));
  app.delete('/mcp', (_req, res) => res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Stateless MCP sessions cannot be deleted' } }));
}
