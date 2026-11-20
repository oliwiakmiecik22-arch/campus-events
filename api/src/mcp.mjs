import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Op } from 'sequelize';
import { z } from 'zod';

const registrationInput = {
  eventId: z.number().int().positive(),
  name: z.string().trim().min(2, 'Enter your name (at least 2 characters)').max(100, 'Use at most 100 characters'),
  email: z.email('Enter a valid email address').toLowerCase()
};

const formatResult = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const formatError = (error) => ({ content: [{ type: 'text', text: JSON.stringify({ error }) }], isError: true });

export function createMcpServer({ Event, registerForEvent }) {
  const server = new McpServer({ name: 'campus-events', version: '1.0.0' });

  server.registerTool('get_upcoming_events', {
    description: 'List future campus events, soonest first.',
    inputSchema: {}
  }, async () => {
    const events = await Event.findAll({ where: { startsAt: { [Op.gt]: new Date() } }, order: [['startsAt', 'ASC']] });
    return formatResult(events.map((event) => event.toJSON()));
  });

  server.registerTool('get_past_events', {
    description: 'List past campus events, most recent first.',
    inputSchema: {}
  }, async () => {
    const events = await Event.findAll({ where: { startsAt: { [Op.lte]: new Date() } }, order: [['startsAt', 'DESC']] });
    return formatResult(events.map((event) => event.toJSON()));
  });

  server.registerTool('register_for_event', {
    description: 'Register a person for a campus event.',
    inputSchema: registrationInput
  }, async ({ eventId, name, email }) => {
    const result = await registerForEvent(eventId, { name, email });
    if (result.error) return formatError(result.error);
    return formatResult(result.registration);
  });

  return server;
}
