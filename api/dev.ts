import { startServer } from './server.js';
import { ensureAdminUser } from './index.js';

const port = Number(process.env.API_PORT) || 3001;

(async () => {
  try {
    await ensureAdminUser();
  } catch (e) {
    console.error('[api] ensureAdminUser failed:', e);
  }
  startServer(port);
})();
