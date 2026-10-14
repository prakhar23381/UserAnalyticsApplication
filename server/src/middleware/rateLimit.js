import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

// A visitor's tracker sends about 12-20 requests a minute (a batch every 5 s
// plus one per page it leaves), so this leaves room for several people
// behind one address.
export const INGEST_LIMIT = { windowMs: 60_000, limit: 120 };

/**
 * Per-client limit on POST /api/events. Counts live in memory, per process.
 *
 * Clients are told apart by `req.ip`, or by `clientIpHeader` when it is set:
 * a header the hosting edge overwrites with the real client address (on
 * Render, `true-client-ip`). Behind Render, X-Forwarded-For keeps whatever
 * the client sent, so it can't be trusted for this.
 */
export function ingestRateLimit({ windowMs, limit } = INGEST_LIMIT, { clientIpHeader = null } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests: try again in a minute' },
    ...(clientIpHeader && {
      // ipKeyGenerator groups IPv6 addresses by /56, so rotating them doesn't help.
      keyGenerator: (req) => ipKeyGenerator(req.get(clientIpHeader)?.trim() || req.ip),
    }),
  });
}
