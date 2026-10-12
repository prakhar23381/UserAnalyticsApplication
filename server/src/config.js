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
};
