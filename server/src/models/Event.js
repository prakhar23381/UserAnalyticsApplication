import mongoose from 'mongoose';

export const EVENT_TYPES = ['page_view', 'click'];
export const DEVICES = ['mobile', 'tablet', 'desktop'];

// What was clicked, so the journey can say `button#buy "Add to cart"`.
const targetSchema = new mongoose.Schema(
  { tag: String, id: String, classes: String, text: String },
  { _id: false, id: false },
);

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, maxlength: 64 },
    type: { type: String, enum: EVENT_TYPES, required: true },
    page_url: { type: String, required: true }, // normalized (lib/normalizeUrl.js); heatmaps group by it
    raw_url: { type: String, required: true }, // exactly what the browser had
    timestamp: { type: Date, required: true }, // client clock
    received_at: { type: Date, default: Date.now }, // server clock

    // click only: document coordinates (pageX/pageY) in CSS px
    x: Number,
    y: Number,
    target: targetSchema,

    // both types: needed to compare clicks across screen sizes
    viewport_w: Number,
    viewport_h: Number,
    doc_w: Number,
    doc_h: Number,
    device: { type: String, enum: DEVICES }, // derived from viewport_w on the server
    referrer: String,
    user_agent: String, // from the request header, not the client body
  },
  {
    versionKey: false,
    // Indexes are built once at startup (index.js), before the server listens.
    autoIndex: false,
  },
);

eventSchema.index({ session_id: 1, timestamp: 1 }); // session journey + sessions list
eventSchema.index({ page_url: 1, type: 1, device: 1 }); // heatmap + pages list
eventSchema.index({ timestamp: -1 }); // time-range queries (recent activity, retention)

export const Event = mongoose.model('Event', eventSchema);
