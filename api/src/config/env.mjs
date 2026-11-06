if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // A local .env file is optional because every setting has a default.
  }
}

export const env = {
  databaseStorage: process.env.DB_STORAGE || './data/events.sqlite',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT || 3000
};
