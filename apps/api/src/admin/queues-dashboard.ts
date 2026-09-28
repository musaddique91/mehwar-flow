import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config';
import { QueuesService } from '../infra/queues.service';

const BASE = '/admin/queues';

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Mounts Bull Board behind HTTP basic auth. Skipped when ADMIN_USER/ADMIN_PASSWORD are not set. */
export function mountQueueDashboard(app: INestApplication, config: AppConfig) {
  if (!config.ADMIN_USER || !config.ADMIN_PASSWORD) return;
  const queues = app.get(QueuesService);
  const adapter = new ExpressAdapter();
  adapter.setBasePath(BASE);
  createBullBoard({
    queues: [queues.publish, queues.media, queues.tokens].map((q) => new BullMQAdapter(q)),
    serverAdapter: adapter,
  });
  const expected = `Basic ${Buffer.from(`${config.ADMIN_USER}:${config.ADMIN_PASSWORD}`).toString('base64')}`;
  app.use(BASE, (req: Request, res: Response, next: NextFunction) => {
    if (safeEqual(req.headers.authorization ?? '', expected)) return next();
    res
      .set('WWW-Authenticate', 'Basic realm="Mehwar queues"')
      .status(401)
      .send('Authentication required');
  });
  app.use(BASE, adapter.getRouter());
}
