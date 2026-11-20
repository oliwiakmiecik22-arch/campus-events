import { app, Event, seedDemoData, sequelize } from './app.mjs';
import { env } from './config/env.mjs';

await sequelize.sync();

// First start on a fresh clone: fill the empty database so the UI has something to show.
if ((await Event.count()) === 0) {
  await seedDemoData();
  console.log('Empty database – demo data added');
}

app.listen(env.port, () => {
  console.log(`Campus Events API running on port ${env.port}`);
});
