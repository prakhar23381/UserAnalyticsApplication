import mongoose from 'mongoose';
import { DEVICES } from './Event.js';

// One document per session, derived from its events (lib/sessionStore.js) so the
// segment filters don't have to aggregate every event on each read. Events stay
// the source of truth: `npm -w server run sessions:rebuild` recreates this.
const sessionSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, maxlength: 64 },
    first_seen: { type: Date, required: true },
    last_seen: { type: Date, required: true },
    duration_ms: { type: Number, required: true },
    event_count: { type: Number, required: true },
    page_views: { type: Number, required: true },
    clicks: { type: Number, required: true },
    pages: [String], // distinct normalized page URLs, in the order first visited
    entry_page: String,
    exit_page: String,
    device: { type: String, enum: DEVICES }, // the first event's
    browser: String, // lib/userAgent.js
    os: String,
    country: String, // two letters, when the host's edge sends it (COUNTRY_HEADER)
    referrer: String, // the referring site's host without www., only when it's another site
    utm_source: String, // from the landing page's URL
    utm_medium: String,
    utm_campaign: String,
    source: String, // utm_source, else referrer, else "Direct"
    updated_at: Date,
  },
  { versionKey: false, autoIndex: false },
);

sessionSchema.index({ session_id: 1 }, { unique: true });
sessionSchema.index({ first_seen: -1 }); // the segment's date range
sessionSchema.index({ last_seen: -1, session_id: 1 }); // the sessions list, most recent first

export const Session = mongoose.model('Session', sessionSchema);
