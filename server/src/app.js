import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { ingestCors } from './middleware/cors.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import eventsRouter from './routes/events.js';

// tracker.js and the demo pages. Resolved from this file, not the working directory.
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

export function createApp({ dashboardOrigins, isProduction = false }) {
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

  app.use('/api/events', ingestCors, eventsRouter);

  app.use(notFound);
  app.use(errorHandler({ isProduction }));
  return app;
}
