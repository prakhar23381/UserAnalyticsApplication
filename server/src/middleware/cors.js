import cors from 'cors';

// The tracker runs on any site and sends no credentials, so ingestion is open.
export const ingestCors = cors({ origin: '*', methods: ['POST'] });

// Analytics reads are for the dashboard only.
export function readCors(dashboardOrigins) {
  return cors({ origin: dashboardOrigins, methods: ['GET'] });
}
