import { sequelize } from '../config/database.mjs';

export function authenticate() {
  return sequelize.authenticate();
}

export function syncDatabase(options) {
  return sequelize.sync(options);
}

export function closeDatabase() {
  return sequelize.close();
}
