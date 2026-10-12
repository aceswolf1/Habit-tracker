const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  uuid: String,
  description: String,
  optional: { type: Boolean, default: false },
  legendary: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  recurrenceId: String,
  order: Number,
  icon: String,
  gifUrl: String,
  // W5: lighter renditions of the same Klipy GIF, picked at selection time.
  // The UI plays the MP4 (with the JPG as poster) and falls back to gifUrl.
  gifVideoUrl: String,
  gifStillUrl: String
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
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date,
  statistics: { type: mongoose.Schema.Types.Mixed, default: null }
});

// UB-15: support listing unfinished/finished cycles by recency
CycleSchema.index({ finished: 1, createdAt: -1 });

module.exports = mongoose.model('Cycle', CycleSchema);
