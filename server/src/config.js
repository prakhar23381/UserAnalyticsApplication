import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load server/.env no matter which directory the process starts in. In
// production there is no file and the variables come from the host instead.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name} (see server/.env.example)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongodbUri: required('MONGODB_URI'),
  // Comma-separated, so a local and a deployed dashboard can both read the API.
  dashboardOrigins: (process.env.DASHBOARD_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
  // A header the hosting edge overwrites with the client's address (Render: true-client-ip).
  // Only set it behind such an edge: anywhere else, clients could send their own.
  clientIpHeader: process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || null,
  // A header the edge sets to the visitor's two-letter country (Cloudflare: cf-ipcountry). Same caveat.
  countryHeader: process.env.COUNTRY_HEADER?.trim().toLowerCase() || null,
};
