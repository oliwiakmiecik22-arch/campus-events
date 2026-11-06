import { Sequelize } from 'sequelize';
import { env } from './env.mjs';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: env.databaseStorage,
  logging: false
});
