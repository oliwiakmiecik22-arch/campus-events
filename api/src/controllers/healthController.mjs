import { checkHealth } from '../services/healthService.mjs';

export async function getHealth(_req, res) {
  await checkHealth();
  res.status(200).json({ status: 'ok' });
}
