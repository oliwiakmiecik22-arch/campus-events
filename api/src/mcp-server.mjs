import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Event, registerForEvent, sequelize } from './app.mjs';
import { createMcpServer } from './mcp.mjs';

await sequelize.sync();
const server = createMcpServer({ Event, registerForEvent });
await server.connect(new StdioServerTransport());
