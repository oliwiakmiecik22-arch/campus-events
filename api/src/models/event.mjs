import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.mjs';

export const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(120), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  capacity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } }
});
