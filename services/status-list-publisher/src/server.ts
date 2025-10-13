// src/server.ts
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { statusRoutes } from './routes/status.js';
import { cfg } from './config.js';

async function main() {
  const app = Fastify({ logger: true });
  app.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/public/'
  });
  app.register(statusRoutes);
  await app.listen({ port: cfg.port, host: '0.0.0.0' });
  app.log.info(`StatusListPublisher up on :${cfg.port}`);
}
main();