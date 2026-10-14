import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { ingestCors, readCors } from './middleware/cors.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { INGEST_LIMIT, ingestRateLimit } from './middleware/rateLimit.js';
import eventsRouter from './routes/events.js';
import heatmapRouter from './routes/heatmap.js';
import overviewRouter from './routes/overview.js';
import pagesRouter from './routes/pages.js';
import sessionsRouter from './routes/sessions.js';

// tracker.js and the demo pages. Resolved from this file, not the working directory.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function createApp({
  dashboardOrigins,
  isProduction = false,
  clientIpHeader = null,
  ingestLimit = INGEST_LIMIT,
}) {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // The dashboard shows demo pages in an iframe behind the heatmap.
          'frame-ancestors': ["'self'", ...dashboardOrigins],
          // Safari upgrades http://localhost to https, which breaks local demo pages.
          'upgrade-insecure-requests': isProduction ? [] : null,
        },
      },
      // Superseded by frame-ancestors; its SAMEORIGIN would block the dashboard iframe.
      xFrameOptions: false,
      // Other sites must be able to load /tracker.js.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });
  app.use(express.static(publicDir));

  // After CORS, so a browser can read the 429; before the router parses the tracker's text/plain body.
  app.use('/api/events', ingestCors, ingestRateLimit(ingestLimit, { clientIpHeader }), eventsRouter);
  app.use('/api', readCors(dashboardOrigins), sessionsRouter, pagesRouter, heatmapRouter, overviewRouter);

  app.use(notFound);
  app.use(errorHandler({ isProduction }));
  return app;
}
