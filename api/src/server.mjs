import { app } from './app.mjs';
import { env } from './config/env.mjs';
import { prepareDatabase } from './services/setupService.mjs';

// First start on a fresh clone: fill the empty database so the UI has something to show.
if (await prepareDatabase()) {
  console.log('Empty database – demo data added');
}

app.listen(env.port, () => {
  console.log(`Campus Events API running on http://localhost:${env.port}/api`);
});
