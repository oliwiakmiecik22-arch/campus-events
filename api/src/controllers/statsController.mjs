import { getStats } from '../services/statsService.mjs';

export async function listStats(_req, res) {
  res.json(await getStats());
}
