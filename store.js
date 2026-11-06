/* ==========================================================================
   London Frontier Week — data layer
   --------------------------------------------------------------------------
   The app reads everything from Store.state. There are two modes:

   static  The built-in copy in data.js. Read-only. This is what you get on
           a plain web host (GitHub Pages), when signed out, or while the
           shared store cannot be reached.
   live    The shared store behind the claude.ai artifact (the `db`
           capability). Everyone with access sees the same data and edits
           land for everyone within a second or two. Who may edit is decided
           by the artifact's sharing settings, not by this code.

   Collections in the shared store, one document per item:
     people/<id>  events/<id>  issues/<id>  dining/<id>  log/<id>
   Each document carries rev, updatedAt and updatedBy. Writes are
   last-writer-wins; the forms check rev before saving and warn if the
   item changed while it was open.
   ========================================================================== */
window.Store = (() => {
  'use strict';
  const seed = window.FRONTIER_DATA;
  const COLS = ['people', 'events', 'issues', 'dining', 'routes'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const nowIso = () => new Date().toISOString();

  const state = {
    mode: 'static',          // static | connecting | live
    reason: '',              // why we are static, for the About sheet
    stale: false,            // live, but the last snapshot came from cache / took too long
    empty: false,            // live and the shared store has no schedule yet
    canWrite: null,          // true / false / null (platform said nothing)
    isOwner: false,
    me: null,                // { id, name, ... } or null
    people: [], events: [], issues: [], dining: [], routes: [], log: [],
    markers: seed.markers, days: seed.days, hotels: seed.hotels, meta: seed.meta
  };
  const listeners = new Set();
  const emit = () => listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });

  let db = null, user = null, assets = null;
  const undoStack = [];
  const sortBy = (arr, k) => arr.slice().sort((a, b) => (a[k] ?? 0) - (b[k] ?? 0));

  function loadSeed() {
    state.people = clone(seed.people).map((p, i) => ({ order: i, ...p }));
    state.events = clone(seed.events);
    state.issues = clone(seed.issues).map((x, i) => ({ order: i, ...x }));
    state.dining = clone(seed.dining).map((x, i) => ({ order: i, ...x }));
    state.routes = clone(seed.routes || []);
  }

  /* ------------------------------------------------------------ connect */
  // The artifact runtime injects window.claude; give it a moment to appear before settling for static mode.
  async function waitForRuntime(ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (window.claude && typeof window.claude.use === 'function') return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
  async function init() {
    loadSeed();
    state.mode = 'connecting'; emit();
    if (!(await waitForRuntime(2500))) { state.mode = 'static'; state.reason = 'This is the built-in copy of the schedule; it is not connected to the shared store.'; emit(); return; }
    try {
      [db, user, assets] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('assets')]);
    } catch (e) { db = null; }
    if (!db) { state.mode = 'static'; state.reason = 'The shared store is not available in this view (you may be signed out). Showing the built-in copy.'; emit(); return; }
    if (user) {
      try {
        state.isOwner = await user.isOwner();
        state.canWrite = await user.can('data.write');
        state.me = await user.me();
      } catch (e) { /* reads never reject, but be safe */ }
    }
    const got = {}, confirmed = {};
    const timer = setTimeout(() => { if (state.mode === 'connecting') { state.stale = true; emit(); } }, 10000);
    const settle = () => {
      if (!COLS.every(c => got[c])) return;
      const empty = got.events.length === 0 && got.people.length === 0;
      state.empty = empty;
      if (!empty) {
        state.people = sortBy(got.people, 'order');
        state.events = got.events;
        state.issues = sortBy(got.issues, 'order');
        state.dining = sortBy(got.dining, 'order');
        state.routes = got.routes.length ? got.routes : clone(seed.routes || []);
      } else {
        loadSeed(); // show the built-in copy until the owner loads it into the store
      }
      if (COLS.every(c => confirmed[c])) { clearTimeout(timer); state.stale = false; state.mode = 'live'; }
      emit();
    };
    COLS.forEach(col => {
      db.collection(col).onSnapshot(snap => {
        got[col] = snap.docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
        if (!(snap.metadata && snap.metadata.fromCache)) confirmed[col] = true;
        settle();
      }, err => {
        clearTimeout(timer);
        state.mode = 'static'; state.reason = `The shared store returned an error (${err && err.code}). Showing the built-in copy.`;
        loadSeed(); emit();
      });
    });
    db.collection('log').orderBy('at', 'desc').limit(60).onSnapshot(snap => {
      state.log = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      emit();
    }, () => {});
  }

  /* ------------------------------------------------------------- writes */
  const editable = () => state.mode === 'live' && state.canWrite !== false;
  function newId(prefix) { return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

  async function readDoc(col, id) {
    const snap = await db.collection(col).doc(id).get();
    return snap.exists ? snap.data() : null;
  }

  // ops: [{col, id, data|null}] — data null means delete. Returns the undo record.
  async function apply(ops, logText) {
    if (!db) throw new Error('read-only');
    const undo = [];
    for (const op of ops) {
      const ref = db.collection(op.col).doc(op.id);
      const before = await readDoc(op.col, op.id);
      undo.push({ col: op.col, id: op.id, before });
      if (op.data === null) { await ref.delete(); }
      else {
        const body = { ...op.data };
        delete body.id;
        body.rev = ((before && before.rev) || 0) + 1;
        body.updatedAt = nowIso();
        body.updatedBy = (state.me && state.me.id) || null;
        await ref.set(body);
      }
    }
    undoStack.push({ ops: undo, text: logText });
    if (undoStack.length > 20) undoStack.shift();
    if (logText) await addLog(logText);
    return undo;
  }
  async function addLog(text) {
    try {
      await db.collection('log').doc(newId('l')).set({ at: nowIso(), by: (state.me && state.me.id) || null, text });
    } catch (e) { console.warn('log failed', e); }
  }
  async function undo() {
    const u = undoStack.pop();
    if (!u || !db) return null;
    for (const op of u.ops) {
      const ref = db.collection(op.col).doc(op.id);
      if (op.before) await ref.set({ ...op.before, rev: (op.before.rev || 0) + 1, updatedAt: nowIso(), updatedBy: (state.me && state.me.id) || null });
      else await ref.delete();
    }
    await addLog(`Undid: ${u.text}`);
    return u.text;
  }
  const canUndo = () => undoStack.length > 0;

  /* Load the built-in copy into an empty shared store (owner's recovery tool). */
  async function seedShared() {
    if (!db) throw new Error('read-only');
    const batches = [
      ['people', seed.people.map((p, i) => ({ order: i, ...p }))],
      ['events', seed.events],
      ['issues', seed.issues.map((x, i) => ({ order: i, ...x }))],
      ['dining', seed.dining.map((x, i) => ({ order: i, ...x }))],
      ['routes', seed.routes || []]
    ];
    let n = 0;
    for (const [col, items] of batches) {
      for (const item of items) {
        const body = { ...item }; delete body.id;
        body.rev = 1; body.updatedAt = nowIso(); body.updatedBy = (state.me && state.me.id) || null;
        await db.collection(col).doc(item.id).set(body); n++;
      }
    }
    await addLog(`Loaded the built-in schedule into the shared store (${n} items)`);
    return n;
  }

  /* Names for the change log: resolve ids to profiles at render time. */
  async function profiles(ids) {
    if (!user || !ids.length) return {};
    try { return await user.profiles(ids); } catch (e) { return {}; }
  }

  /* Photo upload: resize to 320px on the client, upload, return the asset id (or null if unavailable). */
  async function uploadPhoto(file) {
    if (!assets) return null;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const size = 320, c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d'); const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
    const r = await assets.upload(blob);
    return r && r.id ? r.id : null;
  }
  const canUpload = () => !!assets;
  function exportJson() {
    return JSON.stringify({
      meta: state.meta, days: state.days, hotels: state.hotels,
      people: state.people, events: state.events, routes: state.routes, markers: state.markers, issues: state.issues, dining: state.dining
    }, null, 2);
  }

  return { state, init, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, editable, newId, readDoc, apply, undo, canUndo, seedShared, profiles, exportJson, uploadPhoto, canUpload };
})();
