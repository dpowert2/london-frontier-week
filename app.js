/* ==========================================================================
   London Frontier Week — app
   Reads everything from Store.state (store.js), which is either the built-in
   copy (read-only) or the shared store behind the claude.ai artifact (live,
   editable by people the artifact is shared with at Contributor or above).

   Views: schedule · board (who's where) · people · meet (who you'll meet) · logistics · issues
   State lives in the URL hash so any view can be shared as a link:
     #schedule-wed-as-ger   → Wednesday schedule, viewed as Ger Bogan
   ========================================================================== */
(() => {
  'use strict';

  const S = window.Store.state;
  let PEOPLE = [], EVENTS = [], DAYS = [], DAY = {}, P = {}, E = {};
  const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  function sync() { PEOPLE = S.people; EVENTS = S.events; DAYS = S.days; DAY = byId(DAYS); P = byId(PEOPLE); E = byId(EVENTS); }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ------------------------------------------------------------ helpers */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toMin = t => (t && /^\d{2}:\d{2}$/.test(t)) ? (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)) : null;
  const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const dur = m => { const h = Math.floor(m / 60), mm = m % 60; return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`; };
  const OPEN_END = 150; // minutes assumed for an event with no end time (layout and overlap only)
  const startOf = e => toMin(e.start) ?? 0;
  const endOf = e => toMin(e.end) ?? (startOf(e) + OPEN_END);
  const timeLabel = e => e.timeTbc ? `${e.start}–${e.end || '?'} · time TBC` : (e.end ? `${e.start}–${e.end}` : `${e.start} · end TBC`);
  const overlaps = (a, b) => startOf(a) < endOf(b) && startOf(b) < endOf(a);
  const eventsOn = day => EVENTS.filter(e => e.day === day).sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b));
  const personEvents = (pid, day) => eventsOn(day).filter(e => (e.attendees || []).includes(pid));
  const initials = p => p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const first = p => p.name.split(' ')[0];
  const isTbcFor = (e, pid) => e.status === 'tbc' || (e.tbc || []).includes(pid);
  const hotelOf = p => (p.hotel && p.hotel !== 'unknown' && S.hotels[p.hotel]) ? S.hotels[p.hotel] : null;
  const hotelLabel = p => p.hotel === 'unknown' ? 'Hotel not specified' : (hotelOf(p) ? hotelOf(p).short : 'No hotel listed');
  const mapUrl = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const eventMapQuery = e => e.address ? `${(e.venue || '').split(';')[0]}, ${e.address}` : (e.venue && !/TBC|not given|Personal/i.test(e.venue) ? `${e.venue}, London` : null);
  const kindLabel = { session: '', social: 'Social', personal: 'Personal' };
  const venueLine = e => (e.area && !(e.venue || '').includes(e.area)) ? `${e.venue} · ${e.area}` : (e.venue || '');
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  const nameList = ids => ids.map(id => P[id] ? P[id].name : id).join(', ');
  const doneActions = e => new Set(e.actionsDone || []);
  // FCAT hosts (person ids) and the people the group meets at an event (from data.js contacts).
  const hostsOf = e => (e.fcatHosts || []).filter(id => P[id]);
  const contactsFor = eid => (S.contacts || []).filter(c => (c.at || []).some(a => a.e === eid)).map(c => ({ ...c, here: c.at.find(a => a.e === eid) }));
  const LINKEDIN = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.5h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4z"/></svg>';
  function contactCard(c) {
    const meta = [c.role, c.org].filter(Boolean).join(' · ');
    return `<div class="mc"><div class="mc-head"><span class="avatar other" aria-hidden="true">${initials(c)}</span><div class="mc-id"><span class="mc-name">${esc(c.name)}</span>${meta ? `<span class="mc-role">${esc(meta)}</span>` : ''}</div>${c.here && c.here.as ? `<span class="badge badge-default">${esc(c.here.as)}</span>` : ''}</div>
      ${c.bio ? `<p class="mc-bio">${esc(c.bio)}</p>` : ''}${c.here && c.here.note ? `<p class="mc-bio"><b>${esc(c.here.note)}</b></p>` : ''}
      ${c.url ? `<a class="mc-link" href="${esc(c.url)}" target="_blank" rel="noopener">${LINKEDIN} LinkedIn</a>` : ''}</div>`;
  }
  function hostBlock(e) {
    const hosts = hostsOf(e);
    if (!hosts.length && !e.meet) return '';
    return `<div class="host-box">${hosts.length ? `<div class="host-row"><b>FCAT host</b><span class="chips">${hosts.map(id => personChip(P[id])).join('')}</span></div>` : ''}${e.meet ? `<div class="host-row"><b>Meet</b><span>${esc(e.meet)}</span></div>` : ''}</div>`;
  }
  // Stream colours: one colour per area, assigned per day in order of first appearance.
  const PALETTE = [['#7B9BB5', '#E9EFF5'], ['#3F8F8A', '#E2F1EF'], ['#C9962A', '#FBF1DB'], ['#7A6BBF', '#ECE9F7'], ['#C45C7D', '#F8E6EC'], ['#7F9A3E', '#EEF3DF'], ['#4F6DA8', '#E6EBF6'], ['#C2693A', '#F8E8E0']];
  const streamName = e => (e.area || '').trim(); // sessions without an area stay grey
  function streamsFor(day) {
    const seen = new Map();
    eventsOn(day).filter(e => e.kind === 'session' && streamName(e)).forEach(e => { const n = streamName(e); if (!seen.has(n)) seen.set(n, PALETTE[seen.size % PALETTE.length]); });
    return seen;
  }
  function streamStyle(e, streams) {
    if (e.kind === 'social') return '--s-bd:#1C1C2C;--s-bg:#E7E7EC';
    if (e.kind === 'personal' || !streamName(e)) return '--s-bd:#D1D5DB;--s-bg:#F3F4F6';
    const c = (streams || streamsFor(e.day)).get(streamName(e)) || ['#D1D5DB', '#F3F4F6'];
    return `--s-bd:${c[0]};--s-bg:${c[1]}`;
  }
  const streamLegend = day => { const st = streamsFor(day); return st.size ? `<div class="stream-legend">${[...st].map(([n, c]) => `<span><i style="background:${c[1]};border-color:${c[0]}"></i>${esc(n)}</span>`).join('')}<span><i style="background:#E7E7EC;border-color:#1C1C2C"></i>Dinner / social</span></div>` : ''; };
  const enc = encodeURIComponent;
  // "about 1h 15m" → 75; "20–25m by taxi; allow 40m" → 40
  const parseDur = str => { if (!str) return null; const h = str.match(/(\d+)\s*h/), ms = [...str.matchAll(/(\d+)\s*m/g)].map(m => +m[1]); let t = 0; if (h) t += +h[1] * 60; if (ms.length) t += Math.max(...ms); return h || ms.length ? t : null; };
  // A return to the hotel before an evening dinner, when there is time for it (75 minutes or more between
  // the end of the afternoon and the dinner's start) and the person has a hotel on record.
  function hotelReturn(pid, e, prev) {
    if (!prev || e.kind !== 'social' || startOf(e) < 17 * 60 || !hotelOf(P[pid])) return null;
    if (startOf(e) - endOf(prev) < 75) return null;
    const back = parseDur(prev.toHotel) ?? 30;
    const arrive = endOf(prev) + back;
    const leave = leaveBy(legFor('hotel', e), e) || fromMin(startOf(e) - 30);
    const window = toMin(leave) - arrive;
    return window >= 20 ? { arrive: fromMin(arrive), leave, window } : null;
  }
  // Where a person is coming from for event e: the session before it that day, or their hotel.
  function originKey(pid, e) {
    const list = personEvents(pid, e.day); const i = list.findIndex(x => x.id === e.id);
    if (i <= 0) return 'hotel';
    return hotelReturn(pid, e, list[i - 1]) ? 'hotel' : list[i - 1].id;
  }
  function originLabel(pid, key) { if (key === 'hotel') { const h = hotelOf(P[pid]); return h ? h.short : 'wherever you’re staying'; } return E[key] ? (E[key].short || E[key].title) : key; }
  const hotelNote = (pid, key) => key === 'hotel' && P[pid].hotel && P[pid].hotel !== 'sheraton' && P[pid].hotel !== 'unknown' ? '<small>Route planned from the Sheraton on Park Lane; adjust the first step from your hotel.</small>' : '';
  function originPlace(pid, key) { if (key === 'hotel') { const h = hotelOf(P[pid]); return h ? h.mapQuery : null; } return E[key] ? (eventMapQuery(E[key]) || null) : null; }
  function legFor(key, e) {
    if (key === 'hotel') { const t = e.travel; return t && (t.depart || t.route) ? { from: 'hotel', to: e.id, route: t.route || '', duration: t.duration || '', depart: t.depart || '', source: 'briefing', mins: parseDur(t.duration) } : null; }
    const r = S.routes.find(x => x.from === key && x.to === e.id); return r ? { ...r, mins: parseDur(r.duration) } : null;
  }
  function leaveBy(leg, e) { if (!leg) return null; if (leg.depart) return leg.depart; if (leg.mins != null) return fromMin(Math.max(0, startOf(e) - leg.mins - 5)); return null; }
  function dirUrl(pid, key, e) { const o = originPlace(pid, key), d = eventMapQuery(e); return o && d ? `https://www.google.com/maps/dir/?api=1&origin=${enc(o)}&destination=${enc(d)}&travelmode=transit` : (d ? mapUrl(d) : null); }
  // A travel leg card for one person going to e.
  function legCard(pid, e, { compact = false } = {}) {
    const key = originKey(pid, e), leg = legFor(key, e), lb = leaveBy(leg, e), url = dirUrl(pid, key, e);
    if (leg && leg.mins === 0) return ''; // same building: nothing to travel
    const from = originLabel(pid, key), to = e.short || e.title;
    const sugg = leg && leg.source === 'suggested' ? '<span class="badge badge-outline">suggested</span>' : '';
    const edit = editing() && key !== 'hotel' ? `<button class="btn btn-ghost btn-sm" type="button" data-edit-route="${key}" data-to="${e.id}">${leg ? 'Edit route' : 'Set route'}</button>` : '';
    const body = leg
      ? `<b>${lb ? `Leave ${esc(from)} by ${esc(lb)}` : `From ${esc(from)}`}</b> → ${esc(to)}${leg.duration ? ` · ${esc(leg.duration)}` : ''} ${sugg}${leg.route && !compact ? `<small>${esc(leg.route)}</small>` : ''}${compact ? '' : hotelNote(pid, key)}`
      : `<b>From ${esc(from)}</b> → ${esc(to)} <span class="badge badge-light-red">route to plan</span>`;
    return `<div class="leg"><span class="ic">${ICON.go}</span><div class="txt">${body}</div><span class="leg-tools">${url ? `<a class="maplink" href="${url}" target="_blank" rel="noopener">${ICON.pin} Directions</a>` : ''}${edit}</span></div>`;
  }
  // Attendees of e grouped by where they are coming from.
  function originGroups(e) {
    const groups = new Map();
    (e.attendees || []).forEach(pid => {
      if (!P[pid]) return;
      const key = originKey(pid, e);
      const gk = key === 'hotel' ? `hotel:${P[pid].hotel || 'none'}` : key;
      if (!groups.has(gk)) groups.set(gk, { key, pid, label: originLabel(pid, key), people: [] });
      groups.get(gk).people.push(pid);
    });
    return [...groups.values()];
  }
  const linkify = t => esc(t).replace(/(\+?\d[\d ]{8,}\d)/g, m => `<a href="tel:${m.replace(/\s+/g, '')}">${m}</a>`).replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, m => `<a href="mailto:${m}">${m}</a>`);
  const fmtWhen = iso => { try { return new Date(iso).toLocaleString('en-GB', { timeZone: S.meta.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  const ICON = {
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.2 6-10.5A6 6 0 0 0 6 10.5C6 15.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.5" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    go: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chev: '<svg class="arrow" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    tick: '<svg class="tick" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ext: '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M19 14v5H5V5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    silence: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    pencil: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7.5l3 3" stroke="currentColor" stroke-width="1.8"/></svg>'
  };

  /* ------------------------------------------------------------- "now" */
  function londonNow() {
    if (state.fakeNow) return state.fakeNow;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: S.meta.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const mins = ((+parts.hour) % 24) * 60 + (+parts.minute);
    const day = DAYS.find(d => d.date === date);
    return { date, mins, dayId: day ? day.id : null };
  }
  const isNow = (e, now) => now.dayId === e.day && startOf(e) <= now.mins && now.mins < endOf(e);

  /* ------------------------------------------------------------- state */
  const TABS = ['schedule', 'board', 'people', 'meet', 'logistics', 'issues', 'daysheet'];
  const TAB_HAS_DAY = { schedule: true, board: true, people: false, meet: false, logistics: false, issues: true, daysheet: true };
  const state = { tab: 'schedule', day: null, person: null, threshold: 120, peopleFilter: 'all', peopleQuery: '', meetQuery: '', fakeNow: null, edit: false };

  // Hash format (plain names only, so links survive every host):
  //   #schedule-wed              Wednesday schedule
  //   #board-thu-as-ger          Thursday board, viewing as Ger Bogan
  //   #schedule-wed-at-wed-1430  preview the page as it would look at 14:30 on Wednesday
  const HASH_RE = /^#([a-z]+)(?:-(wed|thu|fri))?(?:-as-([a-z0-9-]+?))?(?:-at-(wed|thu|fri)-(\d{4}))?$/;
  let lastWritten = '';
  function readHash() {
    let h = location.hash;
    const legacy = h.match(/^#\/([a-z]+)(?:\/([a-z]+))?(?:\?(.*))?$/);
    if (legacy) {
      const q = new URLSearchParams(legacy[3] || ''), t = (q.get('t') || '').replace(':', '');
      h = `#${legacy[1]}${legacy[2] ? '-' + legacy[2] : ''}${q.get('p') ? '-as-' + q.get('p') : ''}${t ? '-at-' + t : ''}`;
    }
    const m = h.match(HASH_RE);
    state.fakeNow = m && m[4] && DAY[m[4]] ? { date: DAY[m[4]].date, mins: +m[5].slice(0, 2) * 60 + +m[5].slice(2), dayId: m[4] } : null;
    const now = londonNow();
    state.tab = m && TABS.includes(m[1]) ? m[1] : 'schedule';
    state.day = m && m[2] ? m[2] : (state.day || now.dayId || 'wed');
    state.person = m && m[3] && P[m[3]] ? m[3] : null;
    if (!m || !m[3]) { try { const saved = localStorage.getItem('fw-person'); if (saved && P[saved] && !location.hash) state.person = saved; } catch (e) { /* storage unavailable */ } }
  }
  function writeHash({ replace = false } = {}) {
    const h = `#${state.tab}${TAB_HAS_DAY[state.tab] ? '-' + state.day : ''}${state.person ? '-as-' + state.person : ''}${state.fakeNow ? `-at-${state.fakeNow.dayId}-${fromMin(state.fakeNow.mins).replace(':', '')}` : ''}`;
    if (location.hash === h) return;
    lastWritten = h;
    if (replace) history.replaceState(null, '', h); else location.hash = h;
  }
  function navigate(patch, { push = false } = {}) {
    Object.assign(state, patch);
    if ('person' in patch) { try { if (patch.person) localStorage.setItem('fw-person', patch.person); else localStorage.removeItem('fw-person'); } catch (e) { /* storage unavailable */ } }
    writeHash();
    render();
    if (push) window.scrollTo({ top: 0 });
  }

  /* --------------------------------------------------------- components */
  const avatar = (p, cls = '') => p.photo ? `<span class="avatar ${p.group || 'other'} ${cls} has-photo" aria-hidden="true"><img src="/_blob/${esc(p.photo)}" alt=""></span>` : `<span class="avatar ${p.group || 'other'} ${cls}" aria-hidden="true">${initials(p)}</span>`;
  const personChip = (p, tbc = false) => `<button class="chip ${tbc ? 'tbc' : ''}" type="button" data-open-person="${p.id}">${avatar(p)}${esc(p.name)}${tbc ? '<small>TBC</small>' : ''}</button>`;
  const editing = () => state.edit && window.Store.editable();

  function attendeeSummary(e) {
    const ids = e.attendees || [], n = ids.length;
    if (!n) return '<span class="ev-leave"><b>No one assigned</b></span>';
    if (n >= PEOPLE.length) return '<span class="ev-leave"><b>Everyone</b></span>';
    if (n >= PEOPLE.length - 2 && PEOPLE.length > 6) {
      const missing = PEOPLE.filter(p => !ids.includes(p.id)).map(first);
      return `<span class="ev-leave"><b>Everyone</b>&nbsp;except ${esc(missing.join(' and '))}</span>`;
    }
    const shown = ids.slice(0, 6), more = n - shown.length;
    return `<span class="avatar-stack" aria-label="${n} attending">${shown.map(id => P[id] ? avatar(P[id], isTbcFor(e, id) ? 'tbc' : '') : '').join('')}${more > 0 ? `<span class="avatar more">+${more}</span>` : ''}</span>`;
  }

  function eventCard(e, { now, person = null } = {}) {
    const flags = [];
    if (e.status === 'tbc') flags.push('<span class="badge badge-light-red">TBC</span>');
    else if (person && (e.tbc || []).includes(person)) flags.push('<span class="badge badge-light-red">Your place TBC</span>');
    else if (e.tbc && e.tbc.length) flags.push(`<span class="badge badge-outline">${e.tbc.length} to confirm</span>`);
    if (e.timeTbc) flags.push('<span class="badge badge-outline">Time TBC</span>');
    if (e.lunch === 'included') flags.push('<span class="badge badge-default">Lunch included</span>');
    else if (e.lunch) flags.push('<span class="badge badge-default">Lunch</span>');
    else if (kindLabel[e.kind]) flags.push(`<span class="badge badge-default">${kindLabel[e.kind]}</span>`);
    if (isNow(e, now)) flags.push('<span class="badge badge-dark">Now</span>');
    const leave = e.travel && e.travel.depart ? `<span class="ev-leave">${ICON.go} Leave <b>${esc(e.travel.depart)}</b></span>` : '';
    if (e.kind === 'session' && e.area) flags.unshift(`<span class="badge stream-badge">${esc(e.area)}</span>`);
    return `<button class="ev kind-${e.kind} status-${e.status} ${e.lunch === true ? 'is-lunch' : ''} ${isNow(e, now) ? 'is-now' : ''}" type="button" style="${streamStyle(e)}" data-open-event="${e.id}" aria-label="${esc(e.title)}, ${esc(timeLabel(e))}">
      <div class="ev-top"><span class="ev-time">${esc(timeLabel(e))}</span>${flags.join('')}</div>
      <div class="ev-title">${esc(e.title)}</div>
      <div class="ev-venue">${ICON.pin}<span>${esc(venueLine(e))}</span></div>
      ${hostsOf(e).length ? `<div class="ev-host">FCAT host <b>${esc(hostsOf(e).map(id => first(P[id])).join(' & '))}</b>${e.meet ? ' · meeting point set' : ''}</div>` : ''}
      <div class="ev-foot">${person ? '<span></span>' : attendeeSummary(e) + leave}</div>
    </button>`;
  }
  const markerCard = (m, withTime = false) => `<div class="marker" role="note">${ICON.silence}<span>${withTime ? `<b>${esc(m.time)}</b> · ` : ''}${esc(m.title)}</span></div>`;
  const addBtn = (label, attrs) => `<button class="btn btn-ghost btn-sm" type="button" ${attrs}>${ICON.plus} ${label}</button>`;

  /* ---------------------------------------------------------- chrome */
  function renderDaybar() {
    const bar = $('#daybar');
    if (!TAB_HAS_DAY[state.tab]) { bar.hidden = true; return; }
    bar.hidden = false;
    const now = londonNow();
    bar.innerHTML = `<div class="segmented">${DAYS.map(d => `
      <button class="seg ${d.id === state.day ? 'active' : ''} ${d.id === now.dayId ? 'today' : ''}" type="button" role="tab" aria-selected="${d.id === state.day}" data-day="${d.id}">
        ${d.short}<small>${d.num} Nov</small>
      </button>`).join('')}</div>${now.dayId ? `<button class="nowbtn" type="button" data-now>Now</button>` : ''}`;
  }
  function renderViewer() {
    const btn = $('#viewerBtn'), p = state.person ? P[state.person] : null;
    btn.classList.toggle('is-person', !!p);
    $('#viewerAvatar').textContent = p ? initials(p) : 'All';
    $('#viewerName').innerHTML = p ? `<span class="full">${esc(p.name)}</span><span class="short">${esc(first(p))}</span>` : 'Everyone';
  }
  function renderStatus() {
    const el = $('#status'), edit = $('#editBtn');
    const live = S.mode === 'live';
    el.className = `status ${S.mode}${S.stale ? ' stale' : ''}`;
    el.title = live ? (S.stale ? 'Live, but the connection is slow; the copy may be out of date' : 'Live: shared schedule, updates as people edit') : (S.mode === 'connecting' ? 'Connecting to the shared schedule' : 'Read-only copy');
    el.innerHTML = `<i></i><span>${live ? (S.empty ? 'Live · empty' : 'Live') : (S.mode === 'connecting' ? 'Connecting' : 'Read-only')}</span>`;
    const canEdit = window.Store.editable();
    edit.hidden = !canEdit;
    if (!canEdit) state.edit = false;
    edit.classList.toggle('active', state.edit);
    edit.setAttribute('aria-pressed', state.edit ? 'true' : 'false');
    edit.innerHTML = `${ICON.pencil}<span>${state.edit ? 'Editing' : 'Edit'}</span>`;
  }

  /* ---------------------------------------------------------- schedule */
  function freeNow(now) { return PEOPLE.filter(p => !personEvents(p.id, now.dayId).some(e => isNow(e, now))); }
  function nowBanner(day, now) {
    if (now.dayId !== day) return '';
    const list = state.person ? personEvents(state.person, day) : eventsOn(day);
    const current = list.filter(e => isNow(e, now));
    const next = list.find(e => startOf(e) > now.mins);
    if (!current.length && !next) return '';
    const cur = current.length
      ? `<b>Now</b> <span>${current.map(e => `${esc(e.short || e.title)} until ${e.end || 'late'}`).join(' · ')}</span>`
      : `<b>Nothing on right now</b>`;
    const nx = next ? `<span>·</span><b>Next</b> <span>${esc(next.short || next.title)} at ${next.start}${next.travel && next.travel.depart ? `, leave ${next.travel.depart}` : ''}</span>` : '';
    const fn = state.person ? '' : `<span>·</span><a href="#issues-${day}" class="now-link">${freeNow(now).length} free right now</a>`;
    return `<div class="now-banner"><span class="badge">${fromMin(now.mins)}</span>${cur}${nx}${fn}</div>`;
  }

  function viewSchedule() {
    const day = state.day, now = londonNow();
    if (state.person) return viewPersonSchedule(day, now);
    const list = eventsOn(day);
    const items = [];
    list.forEach(e => {
      const last = items[items.length - 1];
      if (last && last.type === 'group' && last.start === e.start) last.events.push(e);
      else items.push({ type: 'group', t: startOf(e), start: e.start, events: [e] });
    });
    S.markers.filter(m => m.day === day).forEach(m => {
      const g = items.find(it => it.type === 'group' && it.start === m.time);
      if (g) (g.markers ||= []).push(m); else items.push({ type: 'marker', t: toMin(m.time), m });
    });
    // General placeholder at the start of the day: who leaves the hotels when, for which session.
    const departures = list.filter(e => e.travel && e.travel.depart && startOf(e) < 15 * 60).map(e => {
      const fromHotel = (e.attendees || []).filter(id => P[id] && originKey(id, e) === 'hotel');
      return fromHotel.length ? { e, n: fromHotel.length, depart: e.travel.depart } : null;
    }).filter(Boolean).sort((a, b) => toMin(a.depart) - toMin(b.depart));
    if (departures.length) {
      const first = departures[0];
      items.push({ type: 'hotel', t: toMin(first.depart), order: -1, html: `<div class="free hotel"><span class="ic">${ICON.go}</span><span class="txt"><b>Leave the hotels</b> · first departure ${esc(first.depart)}<small>${departures.map(d => `${esc(d.depart)} for ${esc(d.e.short || d.e.title)} (${d.n})`).join(' · ')}. Routes are from the Sheraton on Park Lane; the Hilton and Thistle are a few minutes away.</small></span></div>` });
    }
    // General placeholder before an evening dinner: back to the hotels, refresh, leave again in time.
    list.filter(e => e.kind === 'social' && startOf(e) >= 17 * 60).forEach(dinner => {
      const before = list.filter(e => e.id !== dinner.id && e.kind !== 'personal' && endOf(e) <= startOf(dinner) && (e.attendees || []).some(id => (dinner.attendees || []).includes(id)));
      if (!before.length) return;
      const lastEnd = Math.max(...before.map(endOf));
      const leave = leaveBy(legFor('hotel', dinner), dinner) || fromMin(startOf(dinner) - 30);
      if (toMin(leave) - lastEnd < 75) return;
      const afternoon = before.filter(e => !e.lunch && startOf(e) >= 13 * 60);
      const firstEnd = afternoon.length ? Math.min(...afternoon.map(endOf)) : lastEnd;
      const groups = afternoon.filter(e => e.toHotel).map(e => `${e.short || e.title} group back by about ${fromMin(endOf(e) + (parseDur(e.toHotel) ?? 30))}`);
      items.push({ type: 'hotel', t: lastEnd, html: `<div class="free hotel"><span class="ic">${ICON.pin}</span><span class="txt"><b>Back to the hotels and refresh</b> · from ${fromMin(firstEnd)} · leave again by <b>${esc(leave)}</b> for ${esc(dinner.short || dinner.title)}${groups.length ? `<small>${esc(groups.join(' · '))}. Everyone else is free from the end of their last session.</small>` : ''}</span></div>` });
    });
    items.sort((a, b) => a.t - b.t || (a.order || 0) - (b.order || 0));
    const slots = items.map(it => {
      if (it.type === 'hotel') return `<section class="slot"><div class="slot-time"><b>${fromMin(it.t)}</b><small>Hotel</small></div><div class="slot-cards single">${it.html}</div></section>`;
      if (it.type === 'marker') return `<section class="slot"><div class="slot-time"><b>${esc(it.m.time)}</b></div><div class="slot-cards single">${markerCard(it.m)}</div></section>`;
      const n = it.events.length;
      return `<section class="slot">
        <div class="slot-time"><b>${esc(it.start)}</b><small>${n > 1 ? `${n} parallel` : (kindLabel[it.events[0].kind] || '')}</small></div>
        <div class="slot-cards ${n === 1 ? 'single' : ''}">${it.events.map(e => eventCard(e, { now })).join('')}${(it.markers || []).map(m => `<div class="span-all">${markerCard(m)}</div>`).join('')}</div>
      </section>`;
    }).join('');
    const add = editing() ? addBtn('Add event', `data-add-event="${day}"`) : '';
    let body = slots;
    if (now.dayId === day) {
      const past = items.filter(it => it.type === 'group' && it.events.every(e => endOf(e) <= now.mins));
      if (past.length >= 2) {
        const pastHtml = past.map(it => `<section class="slot"><div class="slot-time"><b>${esc(it.start)}</b></div><div class="slot-cards ${it.events.length === 1 ? 'single' : ''}">${it.events.map(e => eventCard(e, { now })).join('')}</div></section>`).join('');
        const rest = items.filter(it => !past.includes(it));
        const restHtml = rest.map(it => {
          if (it.type === 'hotel') return `<section class="slot"><div class="slot-time"><b>${fromMin(it.t)}</b><small>Hotel</small></div><div class="slot-cards single">${it.html}</div></section>`;
          if (it.type === 'marker') return `<section class="slot"><div class="slot-time"><b>${esc(it.m.time)}</b></div><div class="slot-cards single">${markerCard(it.m)}</div></section>`;
          const n = it.events.length;
          return `<section class="slot"><div class="slot-time"><b>${esc(it.start)}</b><small>${n > 1 ? `${n} parallel` : (kindLabel[it.events[0].kind] || '')}</small></div><div class="slot-cards ${n === 1 ? 'single' : ''}">${it.events.map(e => eventCard(e, { now })).join('')}${(it.markers || []).map(m => `<div class="span-all">${markerCard(m)}</div>`).join('')}</div></section>`;
        }).join('');
        body = `<details class="past"><summary>Earlier today · ${past.reduce((a, it) => a + it.events.length, 0)} sessions finished</summary>${pastHtml}</details>${restHtml}`;
      }
    }
    return `${nowBanner(day, now)}
      <div class="section-head"><span class="section-title">${DAY[day].label} ${DAY[day].num} November</span><span class="section-meta">${add || `${list.length} events · tap one for details and who’s free`}</span></div>
      ${streamLegend(day)}
      ${body || `<div class="card empty"><strong>Nothing scheduled yet</strong>${editing() ? 'Use “Add event” to add the first session.' : 'The schedule for this day is empty.'}</div>`}`;
  }

  function viewPersonSchedule(day, now) {
    const p = P[state.person];
    const list = personEvents(p.id, day);
    const head = `<div class="person-head">${avatar(p, 'lg')}<div><h2>${esc(p.name)}</h2><p>${esc(p.role)}${p.hotel ? ` · ${esc(hotelLabel(p))}` : ''}</p></div><button class="btn btn-ghost btn-sm" type="button" data-set-person="">Everyone</button></div>`;
    if (!list.length) {
      return head + `<div class="card empty"><strong>Nothing scheduled for ${esc(first(p))} on ${DAY[day].label}</strong>The schedule has no session for ${esc(first(p))} that day. <a href="#issues-${day}">See open items</a> for the day.${editing() ? `<div class="sheet-actions" style="justify-content:center">${addBtn('Add to a session', `data-add-to-session="${p.id}" data-day="${day}"`)}</div>` : ''}</div>`;
    }
    const items = [];
    const freeBlock = (text, badge = '') => `<div class="free"><span class="ic">${ICON.clock}</span><span class="txt">${text}</span>${badge ? `<span class="badge badge-default">${badge}</span>` : ''}</div>`;
    if (startOf(list[0]) >= 10 * 60 + 30) items.push({ t: 0, free: true, html: freeBlock(`Free until <b>${leaveBy(legFor('hotel', list[0]), list[0]) || list[0].start}</b>`) });
    const pushLeg = (t, e) => { const h = legCard(p.id, e); if (h) items.push({ t, free: true, html: h }); };
    pushLeg(startOf(list[0]) - 1, list[0]);
    list.forEach((e, i) => {
      items.push({ t: startOf(e), html: eventCard(e, { now, person: p.id }) });
      const nx = list[i + 1];
      if (nx) {
        const gap = startOf(nx) - endOf(e);
        const hr = hotelReturn(p.id, nx, e);
        if (hr) {
          items.push({ t: endOf(e) + 1, free: true, html: `<div class="free hotel"><span class="ic">${ICON.pin}</span><span class="txt"><b>Back to ${esc(hotelLabel(p))}</b> by about ${esc(hr.arrive)} (${esc(e.toHotel || 'about 30m')} from ${esc(e.short || e.title)}) · time to refresh · leave again by <b>${esc(hr.leave)}</b> for ${esc(nx.short || nx.title)}</span><span class="badge badge-default">${dur(hr.window)} at the hotel</span></div>` });
        } else {
          const leg = legFor(e.id, nx), lb = leaveBy(leg, nx);
          const freeMins = lb ? toMin(lb) - endOf(e) : gap;
          if (freeMins >= 45) items.push({ t: endOf(e) + 1, free: true, html: freeBlock(`Free <b>${fromMin(endOf(e))}–${lb || nx.start}</b>`, dur(freeMins)) });
        }
        pushLeg(startOf(nx) - 1, nx);
      }
    });
    S.markers.filter(m => m.day === day).forEach(m => items.push({ t: toMin(m.time), html: markerCard(m) }));
    items.sort((a, b) => a.t - b.t);
    const html = items.map(it => `<section class="slot"><div class="slot-time">${it.free ? '' : `<b>${fromMin(Math.min(it.t, 1439))}</b>`}</div><div class="slot-cards single">${it.html}</div></section>`).join('');
    const tools = editing() ? addBtn('Add to a session', `data-add-to-session="${p.id}" data-day="${day}"`) : `${list.length} event${list.length === 1 ? '' : 's'} · travel legs from ${esc(hotelLabel(p))}`;
    return head + nowBanner(day, now) + `<div class="section-head"><span class="section-title">${DAY[day].label} ${DAY[day].num} November</span><span class="section-meta">${tools}</span></div>` + html;
  }

  /* ------------------------------------------------------------- board */
  function packLanes(evs) {
    const lanes = [];
    evs.forEach(e => {
      // Overlaps of up to 30 minutes share a lane and are drawn on top of each other,
      // so a small clash (Summit lunch vs 14:00 meetings) is visible without doubling the row.
      let i = lanes.findIndex(end => end - 30 <= startOf(e));
      if (i < 0) { i = lanes.length; lanes.push(endOf(e)); } else lanes[i] = endOf(e);
      e._lane = i;
    });
    return lanes.length;
  }
  function viewBoard() {
    const day = state.day, now = londonNow();
    const H0 = 8 * 60, H1 = 23 * 60, span = H1 - H0;
    const pct = m => ((Math.min(Math.max(m, H0), H1) - H0) / span) * 100;
    const hours = []; for (let h = 8; h <= 22; h++) hours.push(`<span class="board-hour ${h === 8 ? 'first' : ''}" style="left:${pct(h * 60)}%">${String(h).padStart(2, '0')}:00</span>`);
    const grid = []; for (let h = 9; h <= 22; h++) grid.push(`<i class="board-grid-line" style="left:${pct(h * 60)}%"></i>`);
    const showNow = now.dayId === day && now.mins >= H0 && now.mins <= H1;
    const nowLine = showNow ? `<i class="board-now" style="left:${pct(now.mins)}%"></i>` : '';
    const nowLabel = showNow ? `<span class="board-now-label" style="left:${pct(now.mins)}%">Now</span>` : '';
    const streams = streamsFor(day);
    const rows = PEOPLE.map(p => {
      const evs = personEvents(p.id, day);
      const laneCount = Math.max(1, packLanes(evs));
      const height = laneCount * 38 + 8;
      const blocks = evs.map(e => {
        const left = pct(startOf(e)), width = Math.max(2.2, pct(endOf(e)) - left);
        const cls = `blk kind-${e.kind} status-${e.status} ${(e.tbc || []).includes(p.id) ? 'is-tbc' : ''} ${!e.end ? 'open-end' : ''} ${e.timeTbc ? 'time-tbc' : ''}`;
        return `<button class="${cls}" type="button" style="left:${left}%;width:${width}%;top:${e._lane * 38 + 7}px;${streamStyle(e, streams)}" data-open-event="${e.id}" title="${esc(e.title)} · ${esc(timeLabel(e))}"><span>${esc(e.short || e.title)}</span></button>`;
      }).join('');
      const empty = evs.length ? '' : `<span class="board-empty">Nothing scheduled</span>`;
      return `<div class="board-row ${state.person === p.id ? 'is-viewer' : ''}" style="display:contents">
        <button class="board-name" type="button" data-open-person="${p.id}" style="min-height:${height}px">${avatar(p)}<span class="nm">${esc(first(p))}<small>${esc(p.name.split(' ').slice(1).join(' '))}</small></span></button>
        <div class="board-lane" style="min-height:${height}px">${grid.join('')}${nowLine}${blocks}${empty}</div>
      </div>`;
    }).join('');
    return `<div class="section-head"><span class="section-title">${DAY[day].label} ${DAY[day].num} November · who’s where</span><span class="section-meta">Tap a block for the event, a name for the person</span></div>
      <div class="board-wrap"><div class="board-scroll"><div class="board">
        <div class="board-corner">Attendee</div>
        <div class="board-hours">${hours.join('')}${nowLabel}</div>
        ${rows}
      </div></div>
      <div class="board-legend">${[...streams].map(([n, c]) => `<span><i style="background:${c[1]};border-left-color:${c[0]}"></i>${esc(n)}</span>`).join('')}<span><i class="social"></i>Dinner / social</span><span><i class="tbc"></i>TBC or place to confirm</span><span><i class="personal"></i>Personal time</span></div></div>
      <p class="board-hint">Blank space is unassigned time. A block that fades out on the right has no end time yet. Scroll sideways on a phone.</p>`;
  }

  /* ------------------------------------------------------------ people */
  function filteredPeople() {
    const q = state.peopleQuery.trim().toLowerCase(), f = state.peopleFilter;
    return PEOPLE.filter(p => (f === 'all' || p.group === f) && (!q || `${p.name} ${p.role} ${p.org}`.toLowerCase().includes(q)));
  }
  const personCard = p => `<button class="pc" type="button" data-open-person="${p.id}">${avatar(p)}<span class="pc-body"><span class="pc-name">${esc(p.name)}${p.org ? `<span class="badge badge-default">${esc(p.org)}</span>` : ''}</span><span class="pc-role">${esc(p.role)}</span><span class="pc-hotel">${esc(hotelLabel(p))}</span></span>${ICON.chev}</button>`;
  function viewPeople() {
    const f = state.peopleFilter, list = filteredPeople();
    const pills = [['all', 'Everyone', PEOPLE.length], ['fidelity', 'Fidelity / FCAT', PEOPLE.filter(p => p.group === 'fidelity').length], ['utah', 'Utah guests', PEOPLE.filter(p => p.group === 'utah').length]];
    return `<div class="search-wrap">${ICON.search}<input class="search" id="peopleSearch" type="search" placeholder="Search by name, role or organisation" value="${esc(state.peopleQuery)}" autocomplete="off"></div>
      <div class="people-groups">${pills.map(([id, label, n]) => `<button class="filter-pill ${f === id ? 'active' : ''}" type="button" data-people-filter="${id}">${label} · ${n}</button>`).join('')}${editing() ? `<span style="margin-left:auto">${addBtn('Add person', 'data-add-person')}</span>` : ''}</div>
      <div class="people-grid" id="peopleGrid">${list.map(personCard).join('') || '<div class="card empty"><strong>No one matches</strong>Try a shorter search.</div>'}</div>`;
  }

  /* --------------------------------------------------------- logistics */
  function travelCard(e) {
    const t = e.travel || {}, q = eventMapQuery(e);
    const groups = originGroups(e);
    const earliest = groups.map(g => leaveBy(legFor(g.key, e), e)).filter(Boolean).sort()[0];
    return `<div class="card card-compact tc">
      <div class="tc-head"><div class="tc-depart"><small>${earliest ? 'First to leave' : 'Arrive for'}</small>${esc(earliest || e.start)}</div><div class="tc-to">${esc(e.title)}<small>${esc(timeLabel(e))} · ${esc(venueLine(e))}${t.arrive ? ` · arrive for ${esc(t.arrive)}` : ''}</small></div></div>
      ${groups.map(g => `<div class="origin-row"><span class="origin-who">${g.people.map(id => `<span class="who">${esc(first(P[id]))}</span>`).join('')}</span>${legCard(g.pid, e, { compact: true })}</div>`).join('') || '<p class="section-meta">No one assigned yet.</p>'}
      ${t.onward ? `<div class="tc-meta">${esc(t.onward)}</div>` : ''}
      <div class="tc-foot"><span></span><span style="display:flex;gap:6px">${q ? `<a class="maplink" href="${mapUrl(q)}" target="_blank" rel="noopener">${ICON.pin} Map</a>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-open-event="${e.id}">Details</button></span></div>
    </div>`;
  }
  function personTravel(p) {
    return DAYS.map(d => {
      const evs = personEvents(p.id, d.id);
      const legs = evs.map((e, i) => {
        const hr = i ? hotelReturn(p.id, e, evs[i - 1]) : null;
        const back = hr ? `<div class="leg-row"><span class="leg-time">${esc(evs[i - 1].end || '')}</span><div class="free hotel"><span class="ic">${ICON.pin}</span><span class="txt"><b>Back to ${esc(hotelLabel(p))}</b> by about ${esc(hr.arrive)} · refresh · leave by <b>${esc(hr.leave)}</b></span><span class="badge badge-default">${dur(hr.window)}</span></div></div>` : '';
        const card = legCard(p.id, e);
        return `${back}${card ? `<div class="leg-row"><span class="leg-time">${esc(leaveBy(legFor(originKey(p.id, e), e), e) || '—')}</span>${card}</div>` : ''}`;
      }).join('');
      return `<div class="day-heading"><h2>${d.label}</h2><span>${d.num} November · ${evs.length ? `${evs.length} legs` : 'nothing scheduled'}</span></div>${legs ? `<div class="card card-compact legs">${legs}</div>` : ''}`;
    }).join('');
  }
  function viewLogistics() {
    const viewer = state.person ? P[state.person] : null;
    const days = viewer ? personTravel(viewer) : DAYS.map(d => {
      const evs = eventsOn(d.id).filter(e => (e.attendees || []).length && e.kind !== 'personal');
      return `<div class="day-heading"><h2>${d.label}</h2><span>${d.num} November · ${evs.length} sessions</span></div>
        <div class="travel-grid">${evs.map(travelCard).join('') || '<p class="section-meta">Nothing scheduled.</p>'}</div>`;
    }).join('');
    const groups = {};
    PEOPLE.forEach(p => { const k = p.hotel || 'none'; (groups[k] ||= []).push(p); });
    const order = ['sheraton', 'hilton', 'marriott', 'thistle', 'none', 'unknown'];
    const hotels = order.filter(k => groups[k]).map(k => {
      const h = S.hotels[k];
      const name = h ? h.name : (k === 'none' ? 'No hotel listed' : 'Hotel not specified');
      const note = h && h.note ? `<small>${esc(h.note)}</small>` : '';
      return `<div class="hotel-row"><div><div class="hotel-name">${esc(name)}${note}</div><div class="chips" style="margin-top:8px">${groups[k].map(p => personChip(p)).join('')}</div></div>${h ? `<a class="maplink" href="${mapUrl(h.mapQuery)}" target="_blank" rel="noopener">${ICON.pin} Map</a>` : ''}</div>`;
    }).join('');
    const dining = S.dining.map(d => `<div class="card card-compact dc">
      <div class="dc-head"><div><h3>${esc(d.name)}</h3><div class="when">${esc(d.day)} · ${esc(d.time)}</div></div><span class="badge badge-default">${esc(d.type || '')}</span></div>
      <div class="kv">${d.fcatHost ? `<b>FCAT host</b><span>${esc(d.fcatHost)}</span>` : ''}${d.meet ? `<b>Meet</b><span>${esc(d.meet)}</span>` : ''}<b>Booking</b><span>${esc(d.booking || '')}</span><b>Address</b><span>${esc(d.address || '')}</span><b>Contact</b><span>${linkify(d.contact || '')}</span></div>
      <div class="tc-foot"><span style="display:flex;gap:6px">${d.mapQuery || d.address ? `<a class="maplink" href="${mapUrl(d.mapQuery || d.address)}" target="_blank" rel="noopener">${ICON.pin} Open in Maps</a>` : ''}${d.eventId && E[d.eventId] ? `<button class="btn btn-ghost btn-sm" type="button" data-open-event="${d.eventId}">Who’s going</button>` : ''}</span>${editing() ? `<button class="btn btn-ghost btn-sm" type="button" data-edit-dining="${d.id}">Edit</button>` : ''}</div>
    </div>`).join('');
    const head = viewer ? `<div class="person-head">${avatar(viewer, 'lg')}<div><h2>${esc(viewer.name)}’s travel plan</h2><p>Starting from ${esc(hotelLabel(viewer))} each day, then from the previous session</p></div><button class="btn btn-ghost btn-sm" type="button" data-set-person="">Everyone</button></div>` : '';
    return `${head}<div class="section"><div class="section-head"><span class="section-title">Travel plans</span><span class="section-meta">${viewer ? 'Leave-by times allow five minutes on top of the journey' : 'Grouped by where each person starts · pick a person under “Viewing as” for their own plan'}</span></div>${days}</div>
      <div class="section"><div class="section-head"><span class="section-title">Dinners</span>${editing() ? addBtn('Add booking', 'data-add-dining') : ''}</div><div class="travel-grid">${dining || '<p class="section-meta">No bookings recorded.</p>'}</div></div>
      <div class="section"><div class="section-head"><span class="section-title">Hotels</span><span class="section-meta">Edit a person to change their hotel</span></div><div class="card">${hotels}</div></div>`;
  }

  /* ------------------------------------------------------------ issues */
  function coverage(day, threshold) {
    const freeAllDay = [], gaps = [], freeUntil = [];
    PEOPLE.forEach(p => {
      const evs = personEvents(p.id, day);
      if (!evs.length) { freeAllDay.push(p); return; }
      if (startOf(evs[0]) >= 12 * 60) freeUntil.push({ p, until: evs[0] });
      for (let i = 0; i < evs.length - 1; i++) {
        const gap = startOf(evs[i + 1]) - endOf(evs[i]);
        if (gap >= threshold) gaps.push({ p, from: endOf(evs[i]), to: startOf(evs[i + 1]), gap, after: evs[i], before: evs[i + 1] });
      }
    });
    return { freeAllDay, gaps, freeUntil };
  }
  function viewIssues() {
    const day = state.day, d = DAY[day], ed = editing();
    const all = S.issues.filter(i => i.day === day);
    const open = all.filter(i => !i.done), done = all.filter(i => i.done);
    const master = open.filter(i => i.source !== 'rebuild').sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
    const checks = open.filter(i => i.source === 'rebuild');
    const evs = eventsOn(day);
    const withActions = evs.filter(e => (e.actions || []).length || e.status === 'tbc' || e.timeTbc || (e.tbc || []).length);
    const tbcEvents = evs.filter(e => e.status === 'tbc' || e.timeTbc || (e.tbc || []).length);
    const cov = coverage(day, state.threshold);
    const issueCard = i => `<div class="card card-compact issue ${i.severity} ${i.done ? 'done' : ''}"><span class="issue-sev" aria-hidden="true"></span><div style="flex:1;min-width:0"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p>${i.source === 'rebuild' ? '<div class="src">Found while rebuilding the app · confirm against the master</div>' : ''}${i.done ? `<div class="src">Resolved${i.doneAt ? ` ${fmtWhen(i.doneAt)}` : ''}</div>` : ''}
      ${ed ? `<div class="sheet-actions" style="margin-top:8px"><button class="btn btn-ghost btn-sm" type="button" data-resolve-issue="${i.id}">${i.done ? 'Reopen' : 'Resolve'}</button><button class="btn btn-ghost btn-sm" type="button" data-edit-issue="${i.id}">Edit</button></div>` : ''}</div></div>`;
    const sevBadge = e => e.status === 'tbc' ? '<span class="badge badge-light-red">TBC</span>' : (e.timeTbc ? '<span class="badge badge-outline">Time TBC</span>' : ((e.tbc || []).length ? `<span class="badge badge-outline">${e.tbc.length} to confirm</span>` : ''));
    const actionItem = (e, a) => {
      const isDone = doneActions(e).has(a);
      return ed ? `<li class="${isDone ? 'done' : ''}"><label class="check"><input type="checkbox" data-toggle-action="${e.id}" value="${esc(a)}" ${isDone ? 'checked' : ''}><span>${esc(a)}</span></label></li>` : `<li class="${isDone ? 'done' : ''}">${esc(a)}</li>`;
    };
    const now = londonNow();
    const freeNowCard = now.dayId === day ? `<div class="section"><div class="section-head"><span class="section-title">Free right now · ${fromMin(now.mins)}</span></div><div class="card"><div class="chips">${freeNow(now).map(p => personChip(p)).join('') || '<p class="section-meta">Everyone is in a session.</p>'}</div></div></div>` : '';
    return `${freeNowCard}<div class="stat-row">
        <div class="stat-cell"><div class="stat-label">Critical</div><div class="stat-value ${master.some(i => i.severity === 'critical') ? 'accent' : ''}">${master.filter(i => i.severity === 'critical').length}</div></div>
        <div class="stat-cell"><div class="stat-label">Warnings</div><div class="stat-value">${master.filter(i => i.severity === 'warning').length}</div></div>
        <div class="stat-cell"><div class="stat-label">Events with TBCs</div><div class="stat-value">${tbcEvents.length}</div></div>
        <div class="stat-cell"><div class="stat-label">People with nothing on</div><div class="stat-value">${cov.freeAllDay.length}</div></div>
      </div>

      <div class="section"><div class="section-head"><span class="section-title">${d.label} conflicts</span><span class="section-meta">${ed ? addBtn('Add item', `data-add-issue="${day}"`) : 'From the briefing master'}</span></div>
        <div class="issue-list">${master.map(issueCard).join('') || '<div class="card empty">No open conflicts for this day.</div>'}</div></div>

      <div class="section"><div class="section-head"><span class="section-title">To confirm, by event</span>${ed ? '<span class="section-meta">Tick an item when it is done</span>' : ''}</div>
        <div class="card">${withActions.map(e => `<div class="action-group">
          <button class="action-title" type="button" data-open-event="${e.id}">${esc(e.title)} <small>${esc(timeLabel(e))}</small>${sevBadge(e)}</button>
          <ul class="action-items">${(e.actions || []).map(a => actionItem(e, a)).join('')}${(e.tbc || []).length && e.status !== 'tbc' ? `<li>Attendance to confirm: ${esc(nameList(e.tbc))}</li>` : ''}</ul>
        </div>`).join('') || '<p class="empty">Nothing to confirm.</p>'}</div></div>

      <div class="section"><div class="section-head"><span class="section-title">Free time</span>
          <label class="section-meta">Flag gaps of <select class="select" id="thresholdSel">${[60, 90, 120, 180].map(v => `<option value="${v}" ${state.threshold === v ? 'selected' : ''}>${dur(v)}+</option>`).join('')}</select></label></div>
        <div class="card">
          ${cov.freeAllDay.length ? `<div class="action-group"><div class="action-title">Nothing scheduled all day</div><div class="chips" style="margin-top:8px">${cov.freeAllDay.map(p => personChip(p)).join('')}</div></div>` : ''}
          ${cov.freeUntil.length ? `<div class="action-group"><div class="action-title">Free until the afternoon</div>${cov.freeUntil.map(x => `<div class="coverage-row">${avatar(x.p)}<span class="nm">${esc(x.p.name)}</span><span class="gap">Nothing before <b>${esc(x.until.short || x.until.title)}</b> at ${x.until.start}</span></div>`).join('')}</div>` : ''}
          <div class="action-group"><div class="action-title">Gaps between sessions <small>${cov.gaps.length} of ${dur(state.threshold)} or more</small></div>
            ${cov.gaps.map(g => `<div class="coverage-row">${avatar(g.p)}<span class="nm">${esc(g.p.name)}</span><span class="gap"><b>${fromMin(g.from)}–${fromMin(g.to)}</b> · after ${esc(g.after.short || g.after.title)}, before ${esc(g.before.short || g.before.title)}</span><span class="badge badge-default dur">${dur(g.gap)}</span></div>`).join('') || '<p class="section-meta" style="margin-top:6px">No gaps at this threshold.</p>'}
          </div>
        </div></div>

      ${checks.length ? `<div class="section"><div class="section-head"><span class="section-title">Data checks</span><span class="section-meta">Where the notes and the schedule disagree</span></div><div class="issue-list">${checks.map(issueCard).join('')}</div></div>` : ''}
      ${done.length ? `<div class="section"><details class="resolved"><summary class="section-title">Resolved · ${done.length}</summary><div class="issue-list" style="margin-top:10px">${done.map(issueCard).join('')}</div></details></div>` : ''}`;
  }

  /* ------------------------------------------------------------ sheets */
  let lastFocus = null;
  const sheetStack = [];
  let currentSheet = null;
  function openSheet(html) {
    if ($('#sheetRoot').hidden) { lastFocus = document.activeElement; sheetStack.length = 0; }
    else if (currentSheet) sheetStack.push(currentSheet);
    currentSheet = null;
    const back = sheetStack.length ? `<button class="sheet-back" type="button" data-sheet-back>‹ Back</button>` : '';
    $('#sheetBody').innerHTML = back + html;
    $('#sheetRoot').hidden = false;
    document.body.classList.add('sheet-open');
    $('#sheetBody').scrollTop = 0;
    $('#sheetClose').focus();
  }
  function closeSheet() {
    sheetStack.length = 0; currentSheet = null;
    $('#sheetRoot').hidden = true;
    document.body.classList.remove('sheet-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  // In-page confirm (browser dialogs are not available inside the artifact frame).
  function askConfirm(message, { ok = 'Confirm', danger = false } = {}) {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'confirm-root';
      box.innerHTML = `<div class="confirm"><p>${esc(message)}</p><div class="sheet-actions"><button class="btn btn-ghost" type="button" data-c="0">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-dark'}" type="button" data-c="1">${esc(ok)}</button></div></div>`;
      box.addEventListener('click', ev => { const b = ev.target.closest('[data-c]'); if (!b && ev.target !== box) return; box.remove(); resolve(!!(b && b.dataset.c === '1')); });
      document.body.appendChild(box);
      box.querySelector('[data-c="1"]').focus();
    });
  }
  let toastTimer = null;
  function toast(text, { undo = false } = {}) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.innerHTML = `<span>${esc(text)}</span>${undo && window.Store.canUndo() ? '<button type="button" data-undo>Undo</button>' : ''}`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 7000);
  }

  function eventSheet(id) {
    const e = E[id]; if (!e) { closeSheet(); return; }
    const remember = () => { currentSheet = () => eventSheet(id); };
    setTimeout(remember, 0);
    const d = DAY[e.day], now = londonNow(), ed = editing();
    const att = e.attendees || [];
    const others = PEOPLE.filter(p => !att.includes(p.id));
    const elsewhere = [], free = [];
    others.forEach(p => {
      const clash = personEvents(p.id, e.day).filter(x => x.id !== e.id && overlaps(x, e));
      if (clash.length) elsewhere.push(`${first(p)} (${clash.map(x => x.short || x.title).join(', ')})`); else free.push(first(p));
    });
    const status = e.status === 'tbc' ? '<span class="badge badge-light-red">TBC</span>' : '<span class="badge badge-ok">Confirmed</span>';
    const q = eventMapQuery(e);
    const tools = ed ? `<div class="sheet-actions"><button class="btn btn-dark btn-sm" type="button" data-edit-event="${e.id}">${ICON.pencil} Edit</button><button class="btn btn-ghost btn-sm" type="button" data-edit-attendance="${e.id}">Attendance</button><button class="btn btn-ghost btn-sm" type="button" data-duplicate-event="${e.id}">Duplicate</button><button class="btn btn-ghost btn-sm danger" type="button" data-delete-event="${e.id}">Delete</button></div>` : '';
    const where = `<div class="sheet-section"><h3>Where</h3><p><b>${esc(e.venue || 'Venue not set')}</b>${e.address ? `<br>${esc(e.address)}` : ''}</p>${q ? `<div class="sheet-actions"><a class="maplink" href="${mapUrl(q)}" target="_blank" rel="noopener">${ICON.pin} Open in Maps</a></div>` : ''}</div>`;
    const about = e.description ? `<div class="sheet-section"><h3>About</h3><p>${esc(e.description)}</p></div>` : '';
    const agenda = (e.agenda || []).length ? `<div class="sheet-section"><h3>Agenda</h3><ul class="agenda">${e.agenda.map(a => `<li><span class="agenda-t">${esc(a.t)}</span><span>${esc(a.text)}</span></li>`).join('')}</ul>${e.agendaNote ? `<p class="section-meta" style="margin-top:8px">${esc(e.agendaNote)}</p>` : ''}</div>` : '';
    const stars = r => { const full = Math.round(r); return '<span class="stars" aria-hidden="true">' + '★'.repeat(full) + '☆'.repeat(5 - full) + '</span>'; };
    const options = (e.options || []).length ? `<div class="sheet-section"><h3>Where to eat · ${e.options.length} options</h3><div class="opts">${e.options.map(o => `<div class="opt"><div class="opt-head"><b>${esc(o.name)}</b><span class="opt-rating">${stars(o.rating)} ${o.rating.toFixed(1)}${o.price ? ` · ${esc(o.price)}` : ''}</span></div><p>${esc(o.blurb)}</p><div class="opt-foot"><small>${esc(o.address)}</small><a class="maplink" href="${mapUrl(`${o.name}, ${o.address}, London`)}" target="_blank" rel="noopener">${ICON.pin} Map</a></div></div>`).join('')}</div><p class="section-meta" style="margin-top:8px">Google ratings as of ${esc(S.meta.updated)}; check opening hours before booking.</p></div>` : '';
    const t = e.travel || {};
    const groups = originGroups(e);
    const travel = groups.length || t.route ? `<div class="sheet-section"><h3>Getting there, by where people start</h3>
      ${groups.map(g => `<div class="origin-group"><div class="chips" style="margin-bottom:6px">${g.people.map(id => `<span class="chip chip-static">${avatar(P[id])}${esc(first(P[id]))}</span>`).join('')}</div>${legCard(g.pid, e)}</div>`).join('') || `<p>No one assigned yet.</p>`}
      ${t.onward ? `<p class="sheet-note" style="margin-top:10px">${esc(t.onward)}</p>` : ''}</div>` : '';
    const dn = doneActions(e);
    const hb = hostBlock(e);
    const hosting = hb ? `<div class="sheet-section"><h3>FCAT host and meeting point</h3>${hb}</div>` : '';
    const cs = contactsFor(e.id);
    const meeting = cs.length || e.alsoMeeting ? `<div class="sheet-section"><h3>Who you’ll meet${cs.length ? ` · ${cs.length}` : ''}</h3>${cs.length ? `<div class="meet-grid">${cs.map(contactCard).join('')}</div>` : ''}${e.alsoMeeting ? `<p class="sheet-note" style="margin-top:10px">${esc(e.alsoMeeting)}</p>` : ''}</div>` : '';
    const org = (e.host || (e.actions || []).length || e.notes) ? `<div class="sheet-section"><h3>Organisation</h3>
      ${e.host ? `<div class="kv" style="margin-bottom:8px"><b>Hosted by</b><span>${esc(e.host)}</span></div>` : ''}
      ${(e.actions || []).length ? `<ul class="sheet-list">${e.actions.map(a => `<li class="${dn.has(a) ? 'done' : ''}">${esc(a)}${dn.has(a) ? ' <span class="badge badge-ok">done</span>' : ''}</li>`).join('')}</ul>` : ''}
      ${e.notes ? `<p class="sheet-note" style="margin-top:10px">${esc(e.notes)}</p>` : ''}</div>` : '';
    const who = `<div class="sheet-section"><h3>Who’s going · ${att.length}</h3><div class="chips">${att.map(id => P[id] ? personChip(P[id], (e.tbc || []).includes(id)) : '').join('') || '<p>No one assigned yet.</p>'}</div></div>`;
    const rest = others.length ? `<div class="sheet-section"><h3>Everyone else at this time</h3>
      ${free.length ? `<p><b>Free (${free.length}):</b> ${esc(free.join(', '))}</p>` : ''}
      ${elsewhere.length ? `<p><b>Elsewhere (${elsewhere.length}):</b> ${esc(elsewhere.join(', '))}</p>` : ''}</div>` : '';
    const meta = e.updatedAt ? `<p class="sheet-meta">Last changed ${fmtWhen(e.updatedAt)}</p>` : '';
    openSheet(`<div class="sheet-kicker">${d ? d.label : ''} · ${esc(timeLabel(e))} ${status}${isNow(e, now) ? '<span class="badge badge-dark">Now</span>' : ''}</div>
      <h2 id="sheetTitle">${esc(e.title)}</h2>
      <p class="sheet-sub">${esc(venueLine(e))}</p>
      ${tools}${hosting}${where}${about}${agenda}${meeting}${options}${travel}${org}${who}${rest}${meta}`);
  }

  function personSheet(id) {
    const p = P[id]; if (!p) { closeSheet(); return; }
    setTimeout(() => { currentSheet = () => personSheet(id); }, 0);
    const hotel = hotelOf(p), ed = editing();
    const days = DAYS.map(d => {
      const evs = personEvents(p.id, d.id);
      const lines = evs.map(e => `<li><span class="t">${esc(e.start)}</span><button type="button" data-open-event="${e.id}">${esc(e.title)}${(e.tbc || []).includes(p.id) || e.status === 'tbc' ? ' <small style="color:var(--accent)">TBC</small>' : ''}</button>${ed ? `<span class="line-tools"><button type="button" class="link" data-move-person="${p.id}" data-event="${e.id}">Move</button><button type="button" class="link" data-remove-from="${e.id}" data-person="${p.id}">Remove</button></span>` : ''}</li>`).join('') || '<li class="none">Nothing scheduled</li>';
      return `<div class="mini-day"><b>${d.short}</b><ul>${lines}${ed ? `<li><button type="button" class="link add" data-add-to-session="${p.id}" data-day="${d.id}">${ICON.plus} Add to a session</button></li>` : ''}</ul></div>`;
    }).join('');
    const viewing = state.person === p.id;
    const tools = ed ? `<button class="btn btn-ghost btn-sm" type="button" data-edit-person="${p.id}">${ICON.pencil} Edit details</button>` : '';
    openSheet(`<div class="sheet-kicker">${esc(p.org || 'Attendee')}${p.group === 'utah' ? '<span class="badge badge-default">Utah guest</span>' : ''}</div>
      <div style="display:flex;gap:14px;align-items:center">${avatar(p, 'xl')}<div><h2 id="sheetTitle" style="padding-right:0">${esc(p.name)}</h2><p class="sheet-sub">${esc(p.role || '')}</p></div></div>
      <div class="sheet-actions">
        <button class="btn ${viewing ? 'btn-ghost' : 'btn-dark'}" type="button" data-set-person="${viewing ? '' : p.id}">${viewing ? 'Back to everyone' : `View as ${esc(first(p))}`}</button>
        ${p.url ? `<a class="btn btn-ghost" href="${esc(p.url)}" target="_blank" rel="noopener">Profile ${ICON.ext}</a>` : ''}${tools}
      </div>
      <div class="sheet-section"><h3>Staying</h3><p><b>${esc(hotelLabel(p))}</b>${hotel && hotel.note ? ` · ${esc(hotel.note)}` : ''}</p>${hotel ? `<div class="sheet-actions"><a class="maplink" href="${mapUrl(hotel.mapQuery)}" target="_blank" rel="noopener">${ICON.pin} Map</a></div>` : ''}</div>
      ${p.bio ? `<div class="sheet-section"><h3>About</h3><p>${esc(p.bio)}</p></div>` : ''}
      <div class="sheet-section"><h3>Their week</h3>${days}</div>
      ${ed ? `<div class="sheet-section"><button class="btn btn-ghost btn-sm danger" type="button" data-delete-person="${p.id}">Remove ${esc(first(p))} from the trip</button></div>` : ''}`);
  }

  function pickerSheet() {
    const cur = state.person || '';
    const item = (id, name, sub, p) => `<button class="picker-item ${cur === id ? 'active' : ''}" type="button" data-set-person="${id}">${p ? avatar(p) : '<span class="avatar other">All</span>'}<span><span class="nm">${esc(name)}</span><small>${esc(sub)}</small></span>${cur === id ? ICON.tick : ''}</button>`;
    openSheet(`<div class="sheet-kicker">Viewing as</div><h2 id="sheetTitle">Whose schedule?</h2><p class="sheet-sub">Pick a person to see their own itinerary, free time and departure times. The link in the address bar updates, so you can send it to them.</p>
      <div class="search-wrap" style="margin-top:14px">${ICON.search}<input class="search" id="pickerSearch" type="search" placeholder="Search" autocomplete="off"></div>
      <div class="picker-list" id="pickerList">${item('', 'Everyone', 'Full schedule', null)}${PEOPLE.map(p => item(p.id, p.name, p.role || '', p)).join('')}</div>`);
    $('#pickerSearch').addEventListener('input', ev => {
      const q = ev.target.value.trim().toLowerCase();
      $$('#pickerList .picker-item').forEach(el => { el.hidden = q && !el.textContent.toLowerCase().includes(q); });
    });
  }

  async function aboutSheet() {
    const live = S.mode === 'live';
    const status = live ? (S.empty ? 'Connected to the shared store, but it is empty.' : 'Connected to the shared store. Changes made here are seen by everyone with access.') : (S.reason || 'Read-only copy.');
    const canEdit = window.Store.editable();
    const log = S.log.slice(0, 40);
    const ids = [...new Set(log.map(l => l.by).filter(Boolean))];
    const ps = await window.Store.profiles(ids);
    const logHtml = log.length ? `<ul class="log">${log.map(l => `<li><span class="t">${fmtWhen(l.at)}</span><span>${esc(l.text)}<small>${esc((ps[l.by] && ps[l.by].name) || (l.by ? 'someone' : ''))}</small></span></li>`).join('')}</ul>` : '<p class="section-meta">No changes recorded yet.</p>';
    openSheet(`<div class="sheet-kicker">About</div><h2 id="sheetTitle">${esc(S.meta.title)}</h2><p class="sheet-sub">${esc(S.meta.subtitle)} · built-in copy dated ${esc(S.meta.updated)}</p>
      <div class="sheet-section"><h3>Status</h3><p>${esc(status)}</p>${live && !canEdit ? '<p style="margin-top:6px">You can view but not edit. Ask the owner to share the artifact with you at Contributor or Editor level to edit.</p>' : ''}${canEdit ? '<p style="margin-top:6px">You can edit. Turn on <b>Edit</b> in the top bar to add or change events, attendance, people and open items.</p>' : ''}
        ${S.isOwner && live && S.empty ? '<div class="sheet-actions"><button class="btn btn-dark" type="button" data-seed>Load the built-in schedule into the shared store</button></div>' : ''}</div>
      ${live ? `<div class="sheet-section"><h3>Recent changes</h3>${logHtml}</div>` : ''}
      <div class="sheet-section"><h3>Source</h3><p>${esc(S.meta.source)}</p></div>
      <div class="sheet-section"><h3>How to use it</h3><ul class="sheet-list">
        <li><b>Schedule</b> shows the day’s sessions in time order. Sessions that run at the same time sit side by side.</li>
        <li><b>Who’s where</b> is one row per person. Blank space is unassigned time.</li>
        <li>Use <b>Viewing as</b> to switch to one person’s itinerary. The address bar updates, so you can send someone their own link.</li>
        <li>Tap any session for the address, departure time, route, who’s going and who is free at that time.</li>
        <li><b>Open items</b> lists conflicts, things still to confirm, and free time by person.</li>
      </ul></div>
      <div class="sheet-section"><h3>Data</h3><div class="sheet-actions"><button class="btn btn-ghost btn-sm" type="button" data-copy-json>Copy all data as JSON</button></div><p class="section-meta" style="margin-top:8px">Paste it into data.js to update the built-in copy or a static site.</p></div>`);
  }

  /* ------------------------------------------------------------- forms */
  function field(f, v) {
    const val = v == null ? '' : v;
    const id = `f-${f.key}`;
    const label = `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>`;
    let input = '';
    if (f.type === 'textarea' || f.type === 'lines') input = `<textarea id="${id}" name="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(f.type === 'lines' ? (Array.isArray(val) ? val.join('\n') : val) : val)}</textarea>`;
    else if (f.type === 'select') input = `<select id="${id}" name="${f.key}">${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    else if (f.type === 'check') return `<div class="fld check-fld"><label class="check"><input type="checkbox" id="${id}" name="${f.key}" ${val ? 'checked' : ''}><span>${esc(f.label)}</span></label>${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
    else if (f.type === 'people') return peoplePicker(f.key, val);
    else if (f.type === 'file') input = `<input id="${id}" name="${f.key}" type="file" accept="image/*">`;
    else input = `<input id="${id}" name="${f.key}" type="${f.type === 'time' ? 'time' : 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} autocomplete="off">`;
    return `<div class="fld ${f.half ? 'half' : ''}">${label}${input}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
  }
  function peoplePicker(key, val) {
    const att = (val && val.attendees) || [], tbc = (val && val.tbc) || [];
    return `<div class="fld"><label>Who’s going</label>
      <div class="pick-tools"><button class="btn btn-ghost btn-sm" type="button" data-pick="all">Everyone</button><button class="btn btn-ghost btn-sm" type="button" data-pick="fidelity">Fidelity / FCAT</button><button class="btn btn-ghost btn-sm" type="button" data-pick="none">No one</button></div>
      <div class="pick">${PEOPLE.map(p => `<div class="pick-row"><label class="check"><input type="checkbox" name="${key}-att" value="${p.id}" ${att.includes(p.id) ? 'checked' : ''}>${avatar(p)}<span>${esc(p.name)}</span></label><label class="check tbc"><input type="checkbox" name="${key}-tbc" value="${p.id}" ${tbc.includes(p.id) ? 'checked' : ''}><span>TBC</span></label></div>`).join('')}</div></div>`;
  }
  function formSheet({ kicker, title, fields, values = {}, submitLabel = 'Save', onSubmit, onDelete, deleteLabel = 'Delete', intro = '' }) {
    openSheet(`<div class="sheet-kicker">${esc(kicker)}</div><h2 id="sheetTitle">${esc(title)}</h2>${intro ? `<p class="sheet-sub">${intro}</p>` : ''}
      <form id="editForm" class="form" novalidate>${fields.map(f => field(f, values[f.key])).join('')}
        <div class="form-foot"><p class="form-error" id="formError" hidden></p><div class="sheet-actions">${onDelete ? `<button class="btn btn-ghost danger" type="button" id="formDelete">${esc(deleteLabel)}</button>` : ''}<span style="flex:1"></span><button class="btn btn-ghost" type="button" data-form-cancel>Cancel</button><button class="btn btn-dark" type="submit" id="formSubmit">${esc(submitLabel)}</button></div></div>
      </form>`);
    const form = $('#editForm');
    const firstInput = form.querySelector('input:not([type=checkbox]),textarea,select'); if (firstInput) firstInput.focus();
    form.addEventListener('click', ev => {
      const pick = ev.target.closest('[data-pick]');
      if (pick) { const mode = pick.dataset.pick; $$('input[name$="-att"]', form).forEach(cb => { cb.checked = mode === 'all' || (mode === 'fidelity' && P[cb.value] && P[cb.value].group === 'fidelity'); }); }
      if (ev.target.closest('[data-form-cancel]')) closeSheet();
    });
    const del = $('#formDelete'); if (del) del.addEventListener('click', () => onDelete());
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const values = {};
      fields.forEach(f => {
        if (f.type === 'check') values[f.key] = form.elements[f.key].checked;
        else if (f.type === 'file') values[f.key] = form.elements[f.key].files[0] || null;
        else if (f.type === 'lines') values[f.key] = form.elements[f.key].value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (f.type === 'people') {
          const att = $$(`input[name="${f.key}-att"]:checked`, form).map(i => i.value);
          values[f.key] = { attendees: att, tbc: $$(`input[name="${f.key}-tbc"]:checked`, form).map(i => i.value).filter(id => att.includes(id)) };
        } else values[f.key] = form.elements[f.key].value.trim();
      });
      const missing = fields.filter(f => f.required && !values[f.key]);
      const err = $('#formError');
      if (missing.length) { err.hidden = false; err.textContent = `Please fill in: ${missing.map(f => f.label).join(', ')}.`; return; }
      const badTime = fields.filter(f => f.type === 'time' && values[f.key] && toMin(values[f.key]) == null);
      if (badTime.length) { err.hidden = false; err.textContent = 'Times must be in 24-hour HH:MM form.'; return; }
      $('#formSubmit').disabled = true;
      try { await onSubmit(values); }
      catch (e) { err.hidden = false; err.textContent = e && e.code === 'invalid_argument' ? 'The store refused this change. You may not have edit access.' : `Could not save: ${(e && e.message) || e}`; $('#formSubmit').disabled = false; }
    });
  }
  async function revGuard(col, id, revAtOpen) {
    if (!id) return true;
    const live = await window.Store.readDoc(col, id);
    if (live && (live.rev || 0) !== (revAtOpen || 0)) return askConfirm('Someone changed this item while you were editing it. Save anyway and overwrite their change?', { ok: 'Overwrite', danger: true });
    return true;
  }

  const DAY_OPTS = () => DAYS.map(d => [d.id, d.label]);
  const HOTEL_OPTS = () => [['sheraton', 'Sheraton Grand London Park Lane'], ['hilton', 'Hilton London Park Lane'], ['marriott', 'London Marriott'], ['thistle', 'Thistle Piccadilly'], ['', 'No hotel listed'], ['unknown', 'Not specified']];

  function eventForm(e, { day, duplicateOf } = {}) {
    const isNew = !e;
    const src = e || duplicateOf;
    const v = src ? { ...src } : { day: day || state.day, kind: 'session', status: 'confirmed', attendees: [], tbc: [] };
    if (duplicateOf) { delete v.id; delete v.rev; delete v.updatedAt; delete v.updatedBy; v.title = `${duplicateOf.title} (copy)`; v.actionsDone = []; }
    const t = v.travel || {};
    formSheet({
      kicker: isNew ? (duplicateOf ? 'Duplicate event' : 'New event') : 'Edit event', title: isNew ? (duplicateOf ? v.title : 'Add an event') : v.title,
      fields: [
        { key: 'title', label: 'Title', required: true },
        { key: 'short', label: 'Short name', half: true, help: 'Shown on the who’s-where board' },
        { key: 'day', label: 'Day', type: 'select', options: DAY_OPTS(), half: true },
        { key: 'start', label: 'Start', type: 'time', required: true, half: true },
        { key: 'end', label: 'End', type: 'time', half: true, help: 'Leave blank if the end is open' },
        { key: 'timeTbc', label: 'Time still to be confirmed', type: 'check' },
        { key: 'status', label: 'Status', type: 'select', options: [['confirmed', 'Confirmed'], ['tbc', 'TBC (not yet confirmed)']], half: true },
        { key: 'kind', label: 'Type', type: 'select', options: [['session', 'Session or meeting'], ['social', 'Dinner or social'], ['personal', 'Personal time']], half: true },
        { key: 'venue', label: 'Venue' },
        { key: 'address', label: 'Address', half: true },
        { key: 'area', label: 'Area', half: true, placeholder: 'e.g. Canary Wharf' },
        { key: 'host', label: 'Hosted by', help: 'The organisation or people hosting' },
        { key: 'fcatHostNames', label: 'FCAT host', half: true, placeholder: 'e.g. Ger, Magda', help: 'First names, comma separated' },
        { key: 'meet', label: 'Meeting point', half: true, placeholder: 'e.g. Sheraton lobby at 08:20' },
        { key: 'description', label: 'About', type: 'textarea' },
        { key: 'notes', label: 'Briefing notes', type: 'textarea', rows: 2 },
        { key: 'actions', label: 'To confirm (one per line)', type: 'lines', rows: 3 },
        { key: 'options', label: 'Where to eat (one per line: Name | rating | price | address | note)', type: 'lines', rows: 3 },
        { key: 'att', label: 'Attendance', type: 'people' },
        { key: 't_depart', label: 'Leave at', type: 'time', half: true },
        { key: 't_from', label: 'Leave from', half: true },
        { key: 't_route', label: 'Route' },
        { key: 't_duration', label: 'Allow', half: true, placeholder: 'about 30m' },
        { key: 't_arrive', label: 'Arrive for', half: true, placeholder: 'defaults to the start time' },
        { key: 't_onward', label: 'Then', type: 'textarea', rows: 2 }
      ],
      values: { ...v, fcatHostNames: (v.fcatHosts || []).filter(id => P[id]).map(id => first(P[id])).join(', '), options: (v.options || []).map(o => [o.name, o.rating, o.price, o.address, o.blurb].join(' | ')), att: { attendees: v.attendees || [], tbc: v.tbc || [] }, t_depart: t.depart, t_from: t.from, t_route: t.route, t_duration: t.duration, t_arrive: t.arrive, t_onward: t.onward },
      onDelete: isNew ? null : () => deleteEvent(v.id),
      onSubmit: async f => {
        if (!(await revGuard('events', isNew ? null : v.id, v.rev))) return;
        const travel = { depart: f.t_depart, from: f.t_from, route: f.t_route, duration: f.t_duration, arrive: f.t_arrive, onward: f.t_onward };
        const hasTravel = Object.values(travel).some(Boolean);
        const id = isNew ? `${f.day}-${slug(f.title)}-${Math.random().toString(36).slice(2, 5)}` : v.id;
        const options = f.options.map(l => { const [name, rating, price, address, blurb] = l.split('|').map(x => x.trim()); return { name, rating: +rating || 0, price: price || '', address: address || '', blurb: blurb || '' }; }).filter(o => o.name);
        const doc = { ...v, id, options, title: f.title, short: f.short || f.title.split(/[—:+(]/)[0].trim().slice(0, 18), day: f.day, start: f.start, end: f.end || null, timeTbc: f.timeTbc, status: f.status, kind: f.kind, venue: f.venue, address: f.address, area: f.area, host: f.host, fcatHosts: f.fcatHostNames.split(',').map(x => x.trim().toLowerCase()).filter(Boolean).map(n => (PEOPLE.find(p => p.id === n || p.name.toLowerCase() === n || first(p).toLowerCase() === n) || {}).id).filter(Boolean), meet: f.meet, description: f.description, notes: f.notes, actions: f.actions, actionsDone: (v.actionsDone || []).filter(a => f.actions.includes(a)), attendees: f.att.attendees, tbc: f.att.tbc };
        if (hasTravel) doc.travel = travel; else delete doc.travel;
        await window.Store.apply([{ col: 'events', id, data: doc }], isNew ? `Added ${f.title} (${DAY[f.day].short} ${f.start})` : `Edited ${f.title}`);
        navigate({ day: f.day, tab: state.tab === 'board' ? 'board' : 'schedule' });
        eventSheet(id);
        toast(isNew ? 'Event added' : 'Saved', { undo: true });
      }
    });
  }
  function attendanceForm(id) {
    const e = E[id];
    formSheet({ kicker: 'Attendance', title: e.title, intro: `${esc(timeLabel(e))} · tick TBC for a place still to confirm`,
      fields: [{ key: 'att', label: 'Attendance', type: 'people' }], values: { att: { attendees: e.attendees || [], tbc: e.tbc || [] } },
      onSubmit: async f => {
        if (!(await revGuard('events', id, e.rev))) return;
        const added = f.att.attendees.filter(x => !(e.attendees || []).includes(x)), removed = (e.attendees || []).filter(x => !f.att.attendees.includes(x));
        const parts = []; if (added.length) parts.push(`added ${nameList(added)}`); if (removed.length) parts.push(`removed ${nameList(removed)}`);
        await window.Store.apply([{ col: 'events', id, data: { ...e, attendees: f.att.attendees, tbc: f.att.tbc } }], `${e.title}: ${parts.join('; ') || 'updated TBC flags'}`);
        eventSheet(id); toast('Attendance saved', { undo: true });
      } });
  }
  async function deleteEvent(id) {
    const e = E[id];
    if (!(await askConfirm(`Delete “${e.title}”? Attendees will simply have nothing scheduled at that time.`, { ok: 'Delete', danger: true }))) return;
    await window.Store.apply([{ col: 'events', id, data: null }], `Deleted ${e.title} (${DAY[e.day] ? DAY[e.day].short : e.day} ${e.start})`);
    closeSheet(); toast('Event deleted', { undo: true });
  }
  function moveSheet(pid, fromId) {
    const p = P[pid], from = E[fromId];
    const cands = eventsOn(from.day).filter(e => e.id !== fromId && !(e.attendees || []).includes(pid));
    const ov = cands.filter(e => overlaps(e, from)), rest = cands.filter(e => !overlaps(e, from));
    const item = e => `<button class="picker-item" type="button" data-do-move="${pid}" data-from="${fromId}" data-to="${e.id}"><span class="avatar other">${esc(e.start)}</span><span><span class="nm">${esc(e.title)}</span><small>${esc(timeLabel(e))} · ${esc(venueLine(e))}</small></span></button>`;
    openSheet(`<div class="sheet-kicker">Move</div><h2 id="sheetTitle">Move ${esc(p.name)}</h2><p class="sheet-sub">From <b>${esc(from.title)}</b> (${esc(timeLabel(from))}) to:</p>
      ${ov.length ? `<div class="sheet-section"><h3>Same time</h3><div class="picker-list">${ov.map(item).join('')}</div></div>` : ''}
      ${rest.length ? `<div class="sheet-section"><h3>Other ${DAY[from.day].label} sessions</h3><div class="picker-list">${rest.map(item).join('')}</div></div>` : ''}
      ${!cands.length ? '<p class="sheet-section">No other sessions that day to move to.</p>' : ''}
      <div class="sheet-actions"><button class="btn btn-ghost" type="button" data-open-person="${pid}">Cancel</button></div>`);
  }
  async function doMove(pid, fromId, toId) {
    const p = P[pid], from = E[fromId], to = E[toId];
    const ops = [
      { col: 'events', id: fromId, data: { ...from, attendees: (from.attendees || []).filter(x => x !== pid), tbc: (from.tbc || []).filter(x => x !== pid) } },
      { col: 'events', id: toId, data: { ...to, attendees: [...(to.attendees || []), pid] } }
    ];
    await window.Store.apply(ops, `Moved ${p.name} from ${from.title} to ${to.title}`);
    personSheet(pid); toast(`Moved ${first(p)} to ${to.short || to.title}`, { undo: true });
  }
  function addToSessionSheet(pid, day) {
    const p = P[pid];
    const cands = eventsOn(day).filter(e => !(e.attendees || []).includes(pid));
    const item = e => `<button class="picker-item" type="button" data-do-add="${pid}" data-to="${e.id}"><span class="avatar other">${esc(e.start)}</span><span><span class="nm">${esc(e.title)}</span><small>${esc(timeLabel(e))} · ${esc(venueLine(e))}</small></span></button>`;
    openSheet(`<div class="sheet-kicker">Add to a session</div><h2 id="sheetTitle">${esc(p.name)} · ${DAY[day].label}</h2>
      <div class="picker-list" style="margin-top:12px">${cands.map(item).join('') || '<p>Already in every session that day.</p>'}</div>
      <div class="sheet-actions"><button class="btn btn-ghost" type="button" data-open-person="${pid}">Cancel</button></div>`);
  }
  async function doAdd(pid, toId) {
    const p = P[pid], to = E[toId];
    await window.Store.apply([{ col: 'events', id: toId, data: { ...to, attendees: [...(to.attendees || []), pid] } }], `Added ${p.name} to ${to.title}`);
    personSheet(pid); toast(`Added ${first(p)} to ${to.short || to.title}`, { undo: true });
  }
  async function removeFrom(eid, pid) {
    const e = E[eid], p = P[pid];
    await window.Store.apply([{ col: 'events', id: eid, data: { ...e, attendees: (e.attendees || []).filter(x => x !== pid), tbc: (e.tbc || []).filter(x => x !== pid) } }], `Removed ${p.name} from ${e.title}`);
    personSheet(pid); toast(`Removed ${first(p)} from ${e.short || e.title}`, { undo: true });
  }
  function personForm(p) {
    const isNew = !p, v = p || { group: 'fidelity', hotel: 'unknown' };
    formSheet({ kicker: isNew ? 'New person' : 'Edit person', title: isNew ? 'Add a person' : v.name,
      fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'role', label: 'Role' },
        { key: 'org', label: 'Organisation', half: true },
        { key: 'group', label: 'Group', type: 'select', options: [['fidelity', 'Fidelity / FCAT'], ['utah', 'Utah guest'], ['other', 'Other']], half: true },
        { key: 'hotel', label: 'Hotel', type: 'select', options: HOTEL_OPTS() },
        { key: 'bio', label: 'Short bio', type: 'textarea' },
        { key: 'url', label: 'Profile link', placeholder: 'https://…' },
        ...(window.Store.canUpload() ? [{ key: 'photo', label: 'Photo', type: 'file', help: v.photo ? 'A photo is set; choose a file to replace it.' : 'Square crop is applied automatically.' }] : [])
      ],
      values: { ...v, hotel: v.hotel == null ? '' : v.hotel },
      onDelete: isNew ? null : () => deletePerson(v.id), deleteLabel: 'Remove from trip',
      onSubmit: async f => {
        if (!(await revGuard('people', isNew ? null : v.id, v.rev))) return;
        const id = isNew ? `${slug(f.name).split('-')[0]}-${Math.random().toString(36).slice(2, 5)}` : v.id;
        const order = isNew ? Math.max(-1, ...PEOPLE.map(x => x.order ?? 0)) + 1 : v.order;
        const doc = { ...v, id, order, name: f.name, role: f.role, org: f.org, group: f.group, hotel: f.hotel === '' ? null : f.hotel, bio: f.bio, url: f.url || null };
        if (f.photo) { const pid = await window.Store.uploadPhoto(f.photo); if (pid) doc.photo = pid; }
        await window.Store.apply([{ col: 'people', id, data: doc }], isNew ? `Added ${f.name}` : `Edited ${f.name}’s details`);
        personSheet(id); toast(isNew ? 'Person added' : 'Saved', { undo: true });
      } });
  }
  async function deletePerson(id) {
    const p = P[id];
    const inEvents = EVENTS.filter(e => (e.attendees || []).includes(id));
    if (!(await askConfirm(`Remove ${p.name} from the trip? They will be taken out of ${inEvents.length} session${inEvents.length === 1 ? '' : 's'}.`, { ok: 'Remove', danger: true }))) return;
    const ops = [{ col: 'people', id, data: null }, ...inEvents.map(e => ({ col: 'events', id: e.id, data: { ...e, attendees: e.attendees.filter(x => x !== id), tbc: (e.tbc || []).filter(x => x !== id) } }))];
    await window.Store.apply(ops, `Removed ${p.name} from the trip`);
    if (state.person === id) state.person = null;
    closeSheet(); navigate({}); toast(`${first(p)} removed`, { undo: true });
  }
  function issueForm(i, { day } = {}) {
    const isNew = !i, v = i || { day: day || state.day, severity: 'warning', source: 'team' };
    formSheet({ kicker: isNew ? 'New open item' : 'Edit open item', title: isNew ? 'Add an open item' : v.title,
      fields: [
        { key: 'day', label: 'Day', type: 'select', options: DAY_OPTS(), half: true },
        { key: 'severity', label: 'Severity', type: 'select', options: [['critical', 'Critical'], ['warning', 'Warning'], ['check', 'Check']], half: true },
        { key: 'title', label: 'Title', required: true },
        { key: 'text', label: 'Detail', type: 'textarea', required: true }
      ], values: v,
      onDelete: isNew ? null : () => deleteIssue(v.id),
      onSubmit: async f => {
        if (!(await revGuard('issues', isNew ? null : v.id, v.rev))) return;
        const id = isNew ? `issue-${Date.now().toString(36)}` : v.id;
        const order = isNew ? Math.max(-1, ...S.issues.map(x => x.order ?? 0)) + 1 : v.order;
        await window.Store.apply([{ col: 'issues', id, data: { ...v, id, order, day: f.day, severity: f.severity, title: f.title, text: f.text } }], isNew ? `Added open item: ${f.title}` : `Edited open item: ${f.title}`);
        closeSheet(); navigate({ tab: 'issues', day: f.day }); toast(isNew ? 'Item added' : 'Saved', { undo: true });
      } });
  }
  async function deleteIssue(id) {
    const i = S.issues.find(x => x.id === id);
    if (!(await askConfirm(`Delete “${i.title}”?`, { ok: 'Delete', danger: true }))) return;
    await window.Store.apply([{ col: 'issues', id, data: null }], `Deleted open item: ${i.title}`);
    closeSheet(); toast('Item deleted', { undo: true });
  }
  async function resolveIssue(id) {
    const i = S.issues.find(x => x.id === id);
    const done = !i.done;
    await window.Store.apply([{ col: 'issues', id, data: { ...i, done, doneAt: done ? new Date().toISOString() : null, doneBy: done ? ((S.me && S.me.id) || null) : null } }], `${done ? 'Resolved' : 'Reopened'}: ${i.title}`);
    toast(done ? 'Resolved' : 'Reopened', { undo: true });
  }
  async function toggleAction(eid, text, checked) {
    const e = E[eid];
    const set = doneActions(e); if (checked) set.add(text); else set.delete(text);
    await window.Store.apply([{ col: 'events', id: eid, data: { ...e, actionsDone: [...set] } }], `${checked ? 'Done' : 'Reopened'}: ${text} (${e.title})`);
  }
  function routeForm(fromId, toId) {
    const from = E[fromId], to = E[toId];
    const existing = S.routes.find(r => r.from === fromId && r.to === toId);
    const v = existing || { from: fromId, to: toId, route: '', duration: '', depart: '', source: 'team' };
    formSheet({ kicker: existing ? 'Edit route' : 'Set route', title: `${from.short || from.title} → ${to.short || to.title}`, intro: `For everyone going from ${esc(from.title)} to ${esc(to.title)}`,
      fields: [
        { key: 'route', label: 'Route', type: 'textarea', rows: 2, required: true, placeholder: 'e.g. Walk to Waterloo, then Jubilee line to Canary Wharf' },
        { key: 'duration', label: 'Allow', half: true, placeholder: 'about 30m' },
        { key: 'depart', label: 'Leave by', type: 'time', half: true, help: 'Optional; otherwise worked out from the start time and the journey' }
      ], values: v,
      onDelete: existing ? async () => { await window.Store.apply([{ col: 'routes', id: existing.id, data: null }], `Removed route ${from.short || from.title} → ${to.short || to.title}`); eventSheet(toId); toast('Route removed', { undo: true }); } : null, deleteLabel: 'Remove route',
      onSubmit: async f => {
        const id = existing ? existing.id : `${fromId}__${toId}`;
        await window.Store.apply([{ col: 'routes', id, data: { ...v, id, route: f.route, duration: f.duration, depart: f.depart || '', source: 'team' } }], `${existing ? 'Edited' : 'Set'} route ${from.short || from.title} → ${to.short || to.title}`);
        eventSheet(toId); toast('Route saved', { undo: true });
      } });
  }
  function diningForm(d) {
    const isNew = !d, v = d || {};
    formSheet({ kicker: isNew ? 'New booking' : 'Edit booking', title: isNew ? 'Add a booking' : v.name,
      fields: [
        { key: 'name', label: 'Restaurant or venue', required: true },
        { key: 'day', label: 'Day', half: true, placeholder: 'Wednesday 11 Nov' },
        { key: 'time', label: 'Time', half: true, placeholder: '19:00–22:00' },
        { key: 'type', label: 'Type', placeholder: 'Team dinner' },
        { key: 'booking', label: 'Booking', placeholder: 'Who and how many' },
        { key: 'address', label: 'Address' },
        { key: 'contact', label: 'Contact' },
        { key: 'eventId', label: 'Linked event', type: 'select', options: [['', 'None'], ...EVENTS.filter(e => e.kind === 'social').map(e => [e.id, `${e.title} (${DAY[e.day] ? DAY[e.day].short : ''})`])] }
      ], values: v,
      onDelete: isNew ? null : () => deleteDining(v.id),
      onSubmit: async f => {
        if (!(await revGuard('dining', isNew ? null : v.id, v.rev))) return;
        const id = isNew ? `dining-${Date.now().toString(36)}` : v.id;
        const order = isNew ? Math.max(-1, ...S.dining.map(x => x.order ?? 0)) + 1 : v.order;
        await window.Store.apply([{ col: 'dining', id, data: { ...v, id, order, name: f.name, day: f.day, time: f.time, type: f.type, booking: f.booking, address: f.address, contact: f.contact, mapQuery: f.address ? `${f.name}, ${f.address}` : v.mapQuery || '', eventId: f.eventId || null } }], isNew ? `Added booking: ${f.name}` : `Edited booking: ${f.name}`);
        closeSheet(); toast(isNew ? 'Booking added' : 'Saved', { undo: true });
      } });
  }
  async function deleteDining(id) {
    const d = S.dining.find(x => x.id === id);
    if (!(await askConfirm(`Delete the ${d.name} booking?`, { ok: 'Delete', danger: true }))) return;
    await window.Store.apply([{ col: 'dining', id, data: null }], `Deleted booking: ${d.name}`);
    closeSheet(); toast('Booking deleted', { undo: true });
  }

  function scrollToNow() {
    const el = $('.is-now') || $('.board-now') || $('.now-banner');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  /* ------------------------------------------------------------ render */
  function viewDaysheet() {
    const day = state.day, d = DAY[day];
    const evs = eventsOn(day);
    const rows = evs.map(e => `<div class="ds-row"><div class="ds-time">${esc(timeLabel(e))}</div><div><b>${esc(e.title)}</b>${e.status === 'tbc' ? ' (TBC)' : ''}<br><span class="ds-venue">${esc(venueLine(e))}${e.address ? `, ${esc(e.address)}` : ''}</span>${e.travel && e.travel.depart ? `<br><span class="ds-venue">Leave ${esc(e.travel.depart)}${e.travel.from ? ` from ${esc(e.travel.from)}` : ''}; ${esc(e.travel.route || '')}</span>` : ''}${hostsOf(e).length || e.meet ? `<br><span class="ds-venue">${hostsOf(e).length ? `FCAT host: ${esc(nameList(hostsOf(e)))}` : ''}${hostsOf(e).length && e.meet ? '. ' : ''}${e.meet ? `Meet: ${esc(e.meet)}` : ''}</span>` : ''}<br><span class="ds-who">${nameList(e.attendees || [])}${(e.tbc || []).length ? ` (TBC: ${nameList(e.tbc)})` : ''}</span>${(e.actions || []).length ? `<br><span class="ds-venue">To confirm: ${e.actions.map(esc).join('; ')}</span>` : ''}</div></div>`).join('');
    const people = PEOPLE.map(p => `<div class="ds-row"><div class="ds-time">${esc(p.name)}</div><div>${personEvents(p.id, day).map(e => `${esc(e.start)} ${esc(e.short || e.title)}`).join(' · ') || '<i>nothing scheduled</i>'}</div></div>`).join('');
    return `<div class="daysheet"><h1>${esc(S.meta.title)} · ${d.label} ${d.num} November</h1><p class="section-meta">Plain day sheet for printing or a screenshot. <a href="#schedule-${day}">Back to the app</a></p>
      <h2>Sessions</h2>${rows}<h2>By person</h2>${people}
      <h2>Open items</h2>${S.issues.filter(i => i.day === day && !i.done).map(i => `<div class="ds-row"><div class="ds-time">${esc(i.severity)}</div><div><b>${esc(i.title)}</b><br>${esc(i.text)}</div></div>`).join('') || '<p>None.</p>'}</div>`;
  }
  /* -------------------------------------------------------------- meet */
  function meetMatches(c, q) { return !q || `${c.name} ${c.role} ${c.org} ${c.bio}`.toLowerCase().includes(q); }
  function meetList() {
    const q = state.meetQuery.trim().toLowerCase(), viewer = state.person;
    const out = DAYS.map(d => {
      const blocks = eventsOn(d.id).filter(e => !viewer || (e.attendees || []).includes(viewer) || hostsOf(e).includes(viewer)).map(e => {
        const cs = contactsFor(e.id).filter(c => meetMatches(c, q));
        const also = e.alsoMeeting && (!q || e.alsoMeeting.toLowerCase().includes(q)) ? e.alsoMeeting : '';
        if (!cs.length && !also) return '';
        return `<section class="card card-compact meet-block">
          <button class="meet-event" type="button" data-open-event="${e.id}"><span class="meet-time">${esc(timeLabel(e))}</span><span class="meet-title">${esc(e.title)}</span><span class="meet-venue">${esc(venueLine(e))}</span></button>
          ${hostBlock(e)}
          ${cs.length ? `<div class="meet-grid">${cs.map(contactCard).join('')}</div>` : ''}
          ${also ? `<p class="sheet-note">${esc(also)}</p>` : ''}
        </section>`;
      }).filter(Boolean);
      return blocks.length ? `<div class="day-heading"><h2>${d.label}</h2><span>${d.num} November</span></div>${blocks.join('')}` : '';
    }).join('');
    return out || `<div class="card empty"><strong>No one matches</strong>${q ? 'Try a shorter search.' : 'No contacts are listed for these sessions yet.'}</div>`;
  }
  function viewMeet() {
    const viewer = state.person ? P[state.person] : null;
    const total = (S.contacts || []).length;
    const head = viewer ? `<div class="person-head">${avatar(viewer, 'lg')}<div><h2>Who ${esc(first(viewer))} will meet</h2><p>Sessions ${esc(first(viewer))} attends or hosts</p></div><button class="btn btn-ghost btn-sm" type="button" data-set-person="">Everyone</button></div>`
      : `<div class="section-head"><span class="section-title">Who you’ll meet</span><span class="section-meta">${total} people across the week · tap a session for its details</span></div>`;
    return `${head}<div class="search-wrap">${ICON.search}<input class="search" id="meetSearch" type="search" placeholder="Search by name, organisation or topic" value="${esc(state.meetQuery)}" autocomplete="off"></div>
      <div id="meetList">${meetList()}</div>`;
  }
  const VIEWS = { schedule: viewSchedule, board: viewBoard, people: viewPeople, meet: viewMeet, logistics: viewLogistics, issues: viewIssues, daysheet: viewDaysheet };
  function render() {
    sync();
    if (state.person && !P[state.person]) state.person = null;
    $$('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === state.tab));
    renderViewer(); renderDaybar(); renderStatus();
    document.body.classList.toggle('editing', editing());
    document.body.dataset.mode = S.mode;
    $('#main').innerHTML = VIEWS[state.tab]();
    document.title = `${S.meta.title} · ${({ schedule: 'Schedule', board: 'Who’s where', people: 'People', meet: 'Who you’ll meet', logistics: 'Travel & stays', issues: 'Open items', daysheet: 'Day sheet' })[state.tab]}`;
    const badge = $('#issuesBadge');
    const n = S.issues.filter(i => i.day === state.day && !i.done && i.severity === 'critical').length;
    badge.hidden = !n; badge.textContent = n;
  }

  /* ------------------------------------------------------------ events */
  const guard = fn => (...a) => fn(...a).catch(err => { console.error(err); toast(err && err.code === 'invalid_argument' ? 'The store refused that change. You may not have edit access.' : 'That change could not be saved.'); });
  const ACTIONS = '[data-sheet-back],[data-now],[data-edit-route],[data-open-event],[data-open-person],[data-set-person],[data-day],[data-tab],[data-people-filter],[data-add-event],[data-edit-event],[data-edit-attendance],[data-duplicate-event],[data-delete-event],[data-move-person],[data-do-move],[data-add-to-session],[data-do-add],[data-remove-from],[data-add-person],[data-edit-person],[data-delete-person],[data-add-issue],[data-edit-issue],[data-resolve-issue],[data-add-dining],[data-edit-dining],[data-seed],[data-copy-json],[data-undo]';
  document.addEventListener('click', ev => {
    const t = ev.target.closest(ACTIONS);
    if (!t) return;
    const ds = t.dataset;
    if ('sheetBack' in ds) { const fn = sheetStack.pop(); if (fn) { const keep = sheetStack.slice(); fn(); sheetStack.length = 0; sheetStack.push(...keep); } else closeSheet(); return; }
    if (ds.openEvent) { ev.preventDefault(); eventSheet(ds.openEvent); return; }
    if (ds.openPerson) { ev.preventDefault(); personSheet(ds.openPerson); return; }
    if ('setPerson' in ds) { ev.preventDefault(); closeSheet(); navigate({ person: ds.setPerson || null, tab: ['schedule', 'board', 'logistics', 'meet'].includes(state.tab) ? state.tab : 'schedule' }, { push: true }); return; }
    if (ds.editRoute) { routeForm(ds.editRoute, ds.to); return; }
    if (ds.addToSession) { addToSessionSheet(ds.addToSession, ds.day); return; }
    if ('now' in ds) { navigate({ day: londonNow().dayId || state.day, tab: state.tab === 'board' ? 'board' : 'schedule' }); scrollToNow(); return; }
    if (ds.day) { ev.preventDefault(); navigate({ day: ds.day }); return; }
    if (ds.tab) { ev.preventDefault(); navigate({ tab: ds.tab }, { push: true }); return; }
    if (ds.peopleFilter) { navigate({ peopleFilter: ds.peopleFilter }); return; }
    if ('addEvent' in ds) { eventForm(null, { day: ds.addEvent }); return; }
    if (ds.editEvent) { eventForm(E[ds.editEvent]); return; }
    if (ds.editAttendance) { attendanceForm(ds.editAttendance); return; }
    if (ds.duplicateEvent) { eventForm(null, { day: E[ds.duplicateEvent].day, duplicateOf: E[ds.duplicateEvent] }); return; }
    if (ds.deleteEvent) { guard(deleteEvent)(ds.deleteEvent); return; }
    if (ds.movePerson) { moveSheet(ds.movePerson, ds.event); return; }
    if (ds.doMove) { guard(doMove)(ds.doMove, ds.from, ds.to); return; }
    if (ds.doAdd) { guard(doAdd)(ds.doAdd, ds.to); return; }
    if (ds.removeFrom) { guard(removeFrom)(ds.removeFrom, ds.person); return; }
    if ('addPerson' in ds) { personForm(null); return; }
    if (ds.editPerson) { personForm(P[ds.editPerson]); return; }
    if (ds.deletePerson) { guard(deletePerson)(ds.deletePerson); return; }
    if (ds.addIssue) { issueForm(null, { day: ds.addIssue }); return; }
    if (ds.editIssue) { issueForm(S.issues.find(x => x.id === ds.editIssue)); return; }
    if (ds.resolveIssue) { guard(resolveIssue)(ds.resolveIssue); return; }
    if ('addDining' in ds) { diningForm(null); return; }
    if (ds.editDining) { diningForm(S.dining.find(x => x.id === ds.editDining)); return; }
    if ('seed' in ds) { t.disabled = true; guard(async () => { const n = await window.Store.seedShared(); toast(`Loaded ${n} items`); closeSheet(); })(); return; }
    if ('copyJson' in ds) { const txt = window.Store.exportJson(); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copied'), () => { openSheet(`<h2 id="sheetTitle">Data</h2><p class="sheet-sub">Select all and copy.</p><textarea class="export" readonly>${esc(txt)}</textarea>`); }); return; }
    if ('undo' in ds) { guard(async () => { const what = await window.Store.undo(); toast(what ? `Undone: ${what}` : 'Nothing to undo'); })(); return; }
  });
  document.addEventListener('input', ev => {
    if (ev.target.id === 'meetSearch') { state.meetQuery = ev.target.value; const box = $('#meetList'); if (box) box.innerHTML = meetList(); return; }
    if (ev.target.id === 'peopleSearch') {
      state.peopleQuery = ev.target.value;
      const grid = $('#peopleGrid'); if (!grid) return;
      grid.innerHTML = filteredPeople().map(personCard).join('') || '<div class="card empty"><strong>No one matches</strong>Try a shorter search.</div>';
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'thresholdSel') navigate({ threshold: +ev.target.value });
    if (ev.target.dataset && ev.target.dataset.toggleAction) guard(toggleAction)(ev.target.dataset.toggleAction, ev.target.value, ev.target.checked);
  });
  $('#viewerBtn').addEventListener('click', pickerSheet);
  $('#aboutBtn').addEventListener('click', () => { aboutSheet(); });
  $('#editBtn').addEventListener('click', () => { state.edit = !state.edit; render(); toast(state.edit ? 'Editing on: open an event or person to change it' : 'Editing off'); });
  $('#sheetClose').addEventListener('click', closeSheet);
  // Swipe down on the handle area to dismiss (phones).
  let touchY = null;
  $('#sheet').addEventListener('touchstart', ev => { touchY = $('#sheetBody').scrollTop === 0 ? ev.touches[0].clientY : null; }, { passive: true });
  $('#sheet').addEventListener('touchend', ev => { if (touchY != null && ev.changedTouches[0].clientY - touchY > 90) closeSheet(); touchY = null; }, { passive: true });
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheetRoot').hidden && !$('.confirm-root')) closeSheet(); });
  window.addEventListener('hashchange', () => { if (location.hash === lastWritten) return; readHash(); render(); });

  // Refresh the "now" markers every minute while open.
  setInterval(() => { if (!$('#sheetRoot').hidden) return; if (londonNow().dayId) render(); }, 60 * 1000);

  // Offline shell (only on a real top-level origin; file:// and the artifact frame have no service workers).
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && window.self === window.top) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ------------------------------------------------------------- start */
  let started = false;
  window.Store.subscribe(() => {
    if (!started) { started = true; sync(); readHash(); writeHash({ replace: true }); }
    render();
  });
  window.Store.init();
})();
