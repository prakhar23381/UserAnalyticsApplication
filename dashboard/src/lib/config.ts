// Plain constants, safe to import from server components (api.ts pulls in SWR,
// which only works in client components).

const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
if (!configuredUrl) {
  throw new Error('Missing NEXT_PUBLIC_API_URL (see dashboard/.env.local.example)');
}

/** Base URL of the API. Inlined at build time, so changing it needs a rebuild. */
export const API_URL = configuredUrl.replace(/\/+$/, '');

export const DEMO_URL = `${API_URL}/demo/`;
