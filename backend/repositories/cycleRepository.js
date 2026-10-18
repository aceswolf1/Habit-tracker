'use strict';
/**
 * CycleRepository — the only module allowed to touch the Cycle mongoose model.
 *
 * The interface is intentionally narrow:
 *   - findByUuid(uuid)
 *   - findCurrentUnfinished()
 *   - listSummaries({ limit, offset }) → { items, total }
 *   - create(data)          (returns a saved doc, ready to mutate)
 *   - save(doc)             (save an already-mutated doc)
 *
 * Higher layers (services, controllers) must not `require('../models/Cycle')`.
 */

function createCycleRepository({ Cycle }) {
  if (!Cycle) throw new Error('createCycleRepository requires { Cycle }');

  return {
    /**
     * Look up a cycle by uuid. Returns the mongoose doc or null.
     */
    async findByUuid(uuid) {
      return Cycle.findOne({ uuid });
    },

    /**
     * v2.2: locate the most recent completion of the given `habitKey`
     * across ALL cycles whose `completedOn` <= `beforeIso`. Used by the
     * scoring service to compute the next combo level without re-loading
     * the entire history.
     *
     * Returns the smallest task-shaped projection:
     *   `{ habitKey, cycleUuid, completedOn, combo, comboBonus, legendary }`
     * (where `habitKey` is the resolved key — habitId or normalized
     * description — so the service can compare with the new task's key).
     * Returns `null` when no prior completion exists.
     *
     * Single-user dataset: a single find() with a projection is enough.
     *
     * Excludes a task only when BOTH `excludeUuid` (cycle) AND
     * `excludeTaskUuid` match — so the same task uuid reused across
     * different cycles is still picked up.
     */
    async findRecentCompletionForHabit(habitKey, beforeIso, opts = {}) {
      if (!habitKey || !beforeIso) return null;
      const excludeUuid = opts.excludeUuid || null;
      const excludeTaskUuid = opts.excludeTaskUuid || null;
      // Project just the task fields we need; mongoose lets us use dot
      // paths in projection but only top-level keys are returned, so we
      // pull the whole doc and walk it server-side. The dataset is small.
      const docs = await Cycle.find({}).lean();
      let best = null; // task with the latest completedOn <= beforeIso
      for (const doc of docs) {
        for (const week of doc.weeks || []) {
          for (const day of week.days || []) {
            for (const t of day.tasks || []) {
              if (!t.completed || !t.completedOn) continue;
              if (t.completedOn > beforeIso) continue;
              if (excludeUuid && doc.uuid === excludeUuid
                  && excludeTaskUuid && t.uuid === excludeTaskUuid) continue;
              const key = t.habitId || `name:${(t.description || '').trim().replace(/\s+/g, ' ').toLowerCase()}`;
              if (key !== habitKey) continue;
              if (!best || t.completedOn > best.t.completedOn) best = { t, doc };
            }
          }
        }
      }
      if (!best) return null;
      const { t: bestTask, doc: bestDoc } = best;
      return {
        habitKey,
        cycleUuid: bestDoc.uuid,
        completedOn: bestTask.completedOn,
        combo: bestTask.combo || 1,
        comboBonus: bestTask.comboBonus || 0,
        legendary: !!bestTask.legendary,
      };
    },

    /**
     * v2.2: lean projection of every task across every cycle — used by
     * the insights endpoint. Returns `{ uuid, startDate, finished, weeks }`
     * with `weeks[].days[].tasks` stripped to the fields the insights
     * service actually reads. Skips finished-only-summaries optimization.
     */
    async findAllForInsights() {
      return Cycle.find({}, {
        uuid: 1,
        name: 1,
        startDate: 1,
        finished: 1,
        finishedAt: 1,
        createdAt: 1,
        progress: 1,
        score: 1,
        weeks: 1,
      }).lean();
    },

    /**
     * Newest unfinished cycle, or null. Sort createdAt desc — same shape the
     * route used pre-refactor (`Cycle.findOne({ finished: false }).sort({ createdAt: -1 })`).
     */
    async findCurrentUnfinished() {
      return Cycle.findOne({ finished: false }).sort({ createdAt: -1 });
    },

    /**
     * Paginated list of cycle summaries, excluding `weeks`. Sort createdAt desc.
     * Returns plain objects (`.lean()`) with the same projection the route used:
     *   uuid, name, subtitle, progress, score, finished, createdAt, finishedAt
     * with safe defaults for missing progress / score / finishedAt.
     *
     * `items` are plain objects; `total` is the unfiltered count (same as before).
     */
    async listSummaries({ limit, offset }) {
      const projection = {
        uuid: 1,
        name: 1,
        subtitle: 1,
        progress: 1,
        score: 1,
        finished: 1,
        createdAt: 1,
        finishedAt: 1,
        // v2.1: include startDate so the list summaries can render undated
        // months distinctly (legacy data without it gets `null`).
        startDate: 1,
      };
      const [docs, total] = await Promise.all([
        Cycle.find()
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .select(projection)
          .lean(),
        Cycle.countDocuments(),
      ]);
      const items = docs.map((c) => ({
        uuid: c.uuid,
        name: c.name,
        subtitle: c.subtitle,
        progress: c.progress || 0,
        score: c.score || 0,
        finished: !!c.finished,
        createdAt: c.createdAt,
        finishedAt: c.finishedAt || null,
        startDate: c.startDate || null,
      }));
      return { items, total };
    },

    /**
     * Create + save a new cycle from a plain data object. Returns the saved doc.
     */
    async create(data) {
      const doc = new Cycle(data);
      return doc.save();
    },

    /**
     * Persist an already-mutated doc (e.g. after the service applied a PATCH).
     */
    async save(doc) {
      return doc.save();
    },
  };
}

module.exports = { createCycleRepository };