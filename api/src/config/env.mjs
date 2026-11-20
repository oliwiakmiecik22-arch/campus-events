if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // Production hosts provide environment variables directly.
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const mcpAuthToken = process.env.MCP_AUTH_TOKEN;

if (nodeEnv === 'production' && (!mcpAuthToken || Buffer.byteLength(mcpAuthToken) < 32)) {
  throw new Error('MCP_AUTH_TOKEN must be configured with at least 32 bytes in production');
}

export const env = Object.freeze({
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite',
  mcpAuthToken
});
