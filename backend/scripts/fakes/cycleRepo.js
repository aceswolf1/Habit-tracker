'use strict';

/**
 * W3-qa fake — in-memory implementation of the `cycleRepository`
 * contract defined in `development/remediation-w3/orchestration-ctx/
 * decisions/layer-contract-w3.md` §"Repositories".
 *
 * - Returns plain objects (no mongoose). `save` returns the object.
 * - All functions are async to mirror the real mongoose repo.
 * - `listSummaries` strips `weeks` (and `statistics`) per the contract.
 *
 * The fake is intentionally framework-free; tests build one with
 * `createFakeCycleRepository()` and call it directly.
 */

function createFakeCycleRepository() {
  /** @type {Map<string, object>} */
  const store = new Map();
  let serial = 0;

  async function findByUuid(uuid) {
    if (!uuid) return null;
    return store.has(uuid) ? clone(store.get(uuid)) : null;
  }

  async function findCurrentUnfinished() {
    const candidates = Array.from(store.values())
      .filter((c) => c && c.finished === false)
      .sort((a, b) => sortByCreatedAtDesc(a, b));
    if (candidates.length === 0) return null;
    return clone(candidates[0]);
  }

  async function listSummaries({ limit, offset } = {}) {
    const lim = Math.max(0, Number.isFinite(limit) ? limit : 50);
    const off = Math.max(0, Number.isFinite(offset) ? offset : 0);
    const all = Array.from(store.values())
      .filter(Boolean)
      .sort(sortByCreatedAtDesc);
    const total = all.length;
    const page = all.slice(off, off + lim).map(toSummary);
    return { items: page, total };
  }

  async function create(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('cycleRepo.create: data must be an object');
    }
    if (!data.uuid) {
      data.uuid = `c-fake-${++serial}`;
    }
    if (store.has(data.uuid)) {
      throw new Error(`cycleRepo.create: duplicate uuid ${data.uuid}`);
    }
    if (data.createdAt == null) data.createdAt = new Date();
    if (data.finishedAt == null) data.finishedAt = null;
    if (data.score == null) data.score = 0;
    if (data.progress == null) data.progress = 0;
    const saved = clone(data);
    store.set(saved.uuid, saved);
    return clone(saved);
  }

  async function save(doc) {
    if (!doc || !doc.uuid) {
      throw new Error('cycleRepo.save: doc must have a uuid');
    }
    store.set(doc.uuid, clone(doc));
    return clone(doc);
  }

  // Test helpers (NOT part of the contract).
  function _reset() {
    store.clear();
    serial = 0;
  }
  function _all() {
    return Array.from(store.values()).map(clone);
  }
  function _raw(uuid) {
    const v = store.get(uuid);
    return v == null ? null : clone(v);
  }

  return {
    findByUuid,
    findCurrentUnfinished,
    listSummaries,
    create,
    save,
    _reset,
    _all,
    _raw,
  };
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

function sortByCreatedAtDesc(a, b) {
  const at = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
  const bt = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
  return bt - at;
}

function toSummary(c) {
  return {
    uuid: c.uuid,
    name: c.name,
    subtitle: c.subtitle,
    progress: c.progress || 0,
    score: c.score || 0,
    finished: !!c.finished,
    createdAt: c.createdAt,
    finishedAt: c.finishedAt || null,
  };
}

module.exports = { createFakeCycleRepository };