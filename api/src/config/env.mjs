if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // A local .env file is optional because every setting has a default.
  }
}

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  databaseStorage: process.env.DB_STORAGE || './data/events.sqlite',
  emailFrom: process.env.EMAIL_FROM,
  emailTimeoutMs: positiveInteger(process.env.EMAIL_TIMEOUT_MS, 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 3000,
  smtpUrl: process.env.SMTP_URL
};
