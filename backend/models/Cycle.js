const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  uuid: String,
  description: String,
  optional: { type: Boolean, default: false },
  legendary: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  // v2.1: server-maintained completion timestamp. Set on a false→true flip,
  // cleared (unset) on a true→false flip. Clients never send it.
  completedAt: Date,
  // v2.1 (D3): cluster id shared by all tasks that name the same habit.
  // Server-assigned on addTasks when missing; preserved through clone/move.
  habitId: String,
  // v2.1 (D4): one of 'common'|'rare'|'essential'|'defense'. Free-form.
  tag: { type: String, enum: ['common', 'rare', 'essential', 'defense'] },
  // v2.1: estimated duration in minutes (1..1440). UI uses this to render
  // "MM:00" / "H:MM:00" overlays; nothing automatic depends on it.
  durationMin: { type: Number, min: 1, max: 1440 },
  // v2.1: one of 'morning'|'afternoon'|'evening'|'night'.
  timeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] },
  // v2.1: 'HH:MM' in 24-hour local format. Only meaningful on dated days.
  dueTime: String,
  labels: { type: [String], default: undefined }, // custom labels (normalized)
  recurrenceId: String,
  order: Number,
  icon: String,
  gifUrl: String,
  // W5: lighter renditions of the same Klipy GIF, picked at selection time.
  // The UI plays the MP4 (with the JPG as poster) and falls back to gifUrl.
  gifVideoUrl: String,
  gifStillUrl: String,
  // V2: optional free-form note (≤ 280 chars). `null` clears the field.
  notes: String,
  // v2.2 — server-maintained strike-combo state. Set on a false→true flip;
  // cleared on a true→false flip. Clients never send these.
  completedOn: String, // 'YYYY-MM-DD' local calendar date
  combo: Number,       // latest combo level (>=1 when completed)
  comboBonus: Number,  // extra XP awarded on top of base (>=0)
  comboBase: Number    // base XP at the time of completion (>=0); used to
                       // reverse the un-check exactly (stored alongside
                       // comboBonus so pre-v2.2 tasks fall back to
                       // POST-recalc tier without missing data).
});

const DaySchema = new mongoose.Schema({
  uuid: String,
  name: String,
  subtitle: String,
  tasks: [TaskSchema]
});

const WeekSchema = new mongoose.Schema({
  uuid: String,
  name: String,
  subtitle: String,
  progress: { type: Number, default: 0 },
  conquered: { type: Boolean, default: false },
  days: [DaySchema]
});

const CycleSchema = new mongoose.Schema({
  uuid: { type: String, unique: true },
  name: String,
  subtitle: String,
  progress: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  weeks: [WeekSchema],
  finished: { type: Boolean, default: false },
  // v2.1: 'YYYY-MM-DD' of the Monday the cycle starts on. Optional so
  // legacy months render as undated (`shared/dates.dayDate` returns null).
  // Day dates are always derived, never stored.
  startDate: String,
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
  statistics: { type: mongoose.Schema.Types.Mixed, default: null }
});

// UB-15: support listing unfinished/finished cycles by recency
CycleSchema.index({ finished: 1, createdAt: -1 });

module.exports = mongoose.model('Cycle', CycleSchema);
