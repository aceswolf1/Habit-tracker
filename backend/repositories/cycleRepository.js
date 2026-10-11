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