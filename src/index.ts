/**
 * The Workshop — Main Entry Point
 * Master craftsman: code quality, git analysis, deployment analysis.
 * Architecture: Trancendos Industry 6.0 / 2060 Standard
 */

import { logger } from './utils/logger';
import { createServer } from './api/server';

const PORT = parseInt(process.env.PORT || '3011', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap(): Promise<void> {
  logger.info({ service: 'the-workshop', port: PORT }, 'The Workshop bootstrapping — master craftsman awakening...');

  const app = createServer();
  const server = app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, 'The Workshop listening — ready to craft');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(() => { logger.info('The Workshop shutdown complete'); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => { logger.error({ err }, 'Uncaught exception'); shutdown('uncaughtException'); });
  process.on('unhandledRejection', (reason) => { logger.error({ reason }, 'Unhandled rejection'); });
}

bootstrap().catch((err) => { logger.error({ err }, 'Bootstrap failed'); process.exit(1); });