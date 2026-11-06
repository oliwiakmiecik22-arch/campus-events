// `npm run seed`: wipes the database and fills it with demo data again.
import { closeDatabase, resetAndSeedDatabase } from './services/setupService.mjs';

await resetAndSeedDatabase();

console.log('Database reset with demo data.');
await closeDatabase();
