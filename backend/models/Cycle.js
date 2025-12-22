const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  uuid: String,
  description: String,
  optional: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  recurrenceId: String,
  order: Number,
  icon: String
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
  uuid: String,
  name: String,
  subtitle: String,
  progress: { type: Number, default: 0 },
  weeks: [WeekSchema],
  finished: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  finishedAt: Date
});

module.exports = mongoose.model('Cycle', CycleSchema);
