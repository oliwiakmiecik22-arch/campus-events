import { envFilePath, resolveDatabaseStorage } from './paths.mjs';

if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile(envFilePath);
  } catch {
    // A local .env file is optional because every setting has a default.
  }
}

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  brevoApiKey: process.env.BREVO_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  databaseStorage: resolveDatabaseStorage(process.env.DB_STORAGE || './data/events.sqlite'),
  emailFrom: process.env.EMAIL_FROM,
  emailTimeoutMs: positiveInteger(process.env.EMAIL_TIMEOUT_MS, 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV,
  port: positiveInteger(process.env.PORT, 3000)
};
