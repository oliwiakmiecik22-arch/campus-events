import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.mjs';

export const Registration = sequelize.define('Registration', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false }
});
