import type { RunResult } from '../game/run';
import type { Reward, SaveData, Settings } from '../game/save';
import { ACHIEVEMENTS } from '../game/save';
import type { Build, CourseSpec, PresetId, VehicleId } from '../sim/types';
import { PAINTS, RESTRAINTS, SUSPENSION, TIRES, VEHICLES, VEHICLE_ORDER } from '../data/vehicles';
import { CARGO, PRESETS, PRESET_ORDER } from '../data/cargo';
import { fmtTime } from './hud';
import { HOLD_MUSIC, LOADING_QUIPS, REVIEWS } from '../data/humor';

export interface ScreenApi {
  save: SaveData;
  logoUrl: string;
  courses: CourseSpec[];
  startRun(courseId?: string): void;
  retry(): void;
  resume(): void;
  toTitle(): void;
  openGarage(): void;
  openContracts(): void;
  openSettings(back: () => void): void;
  openControls(back: () => void): void;
  setBuild(b: Partial<Build>): void;
  buy(item: string, cost: number): boolean;
  owns(item: string): boolean;
  bounceTest(): void;
  /** Dispatcher voice bark for a UI moment (vehicle picks, purchases...). */
  bark(event: string): void;
  applySettings(s: Partial<Settings>): void;
  sfx(id: 'ui-select' | 'ui-back' | 'ui-focus'): void;
  isTouch(): boolean;
}

function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function bind(root: HTMLElement, map: Record<string, () => void>, api: ScreenApi) {
  root.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => {
    const fn = map[b.dataset.act!];
    if (fn)
      b.addEventListener('click', () => {
        api.sfx(b.dataset.act === 'back' ? 'ui-back' : 'ui-select');
        fn();
      });
  });
}

export function loadingScreen(): { root: HTMLElement; set(p: number, text?: string): void; error(msg: string, retry: () => void): void } {
  const root = h(`<div class="screen loading"><div class="kicker">SlingMods Arcade</div><h1 style="font-size:3em;color:var(--yellow);font-style:italic">SEND IT</h1><div class="bar"><i></i></div><div class="muted status">Loading the truck…</div><div class="muted quip" style="font-style:italic;font-size:.9em"></div></div>`);
  root.querySelector('.quip')!.textContent = LOADING_QUIPS[Math.floor(Math.random() * LOADING_QUIPS.length)];
  return {
    root,
    set(p, text) {
      (root.querySelector('.bar i') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
      if (text) root.querySelector('.status')!.textContent = text;
    },
    error(msg, retry) {
      root.querySelector('.status')!.innerHTML = `<span style="color:var(--red)">${esc(msg)}</span>`;
      const b = h(`<button class="btn">Try again</button>`);
      b.addEventListener('click', retry);
      root.appendChild(b);
    },
  };
}

export function titleScreen(api: ScreenApi): HTMLElement {
  const first = !api.save.firstRunDone;
  const root = h(`
    <div class="screen title-screen">
      <div class="title-top">
        <div class="brand-badge"><img src="${api.logoUrl}" alt="SlingMods"><div class="arcade">ARCADE</div></div>
        <div style="display:flex;gap:.6em">
          <button class="icon-btn" data-act="mute" aria-label="Toggle sound">${api.save.settings.muted ? '\u{1F507}' : '\u{1F50A}'}</button>
          <button class="icon-btn" data-act="settings" aria-label="Settings">⚙</button>
        </div>
      </div>
      <div>
        <div class="wordmark">SEND IT</div>
        <div class="tagline">Your parts are out for delivery. <em>Probably.</em></div>
        <div class="title-actions">
          <button class="btn primary" data-act="play"><span>${first ? 'SEND IT' : 'SEND IT AGAIN'}</span></button>
          ${first ? '' : '<button class="btn ghost" data-act="contracts">DISPATCH</button><button class="btn ghost" data-act="garage">LOAD &amp; BUILD</button>'}
        </div>
      </div>
      <div class="title-foot">
        <div class="keys-hint">${
          api.isTouch()
            ? '<span>Right thumb: GAS / BRAKE</span><span>Left thumb: NOSE UP / DOWN</span><span>In the air: TRICK / TOSS</span>'
            : '<span><kbd>W</kbd>Gas</span><span><kbd>S</kbd>Brake</span><span><kbd>A</kbd><kbd>D</kbd>Nose up / down</span><span><kbd>Space</kbd>Trick (hold a direction)</span><span><kbd>E</kbd>Toss parcel</span><span><kbd>R</kbd>Retry</span>'
        }</div>
        <div>Fictional arcade physics. Real-world riding rules still apply.</div>
      </div>
    </div>`);
  bind(
    root,
    {
      play: () => api.startRun(),
      contracts: () => api.openContracts(),
      garage: () => api.openGarage(),
      settings: () => api.openSettings(() => api.toTitle()),
      mute: () => {
        api.applySettings({ muted: !api.save.settings.muted });
        root.querySelector('[data-act="mute"]')!.textContent = api.save.settings.muted ? '\u{1F507}' : '\u{1F50A}';
      },
    },
    api,
  );
  return root;
}

export function pauseScreen(api: ScreenApi): HTMLElement {
  const root = h(`
    <div class="screen menu scrim">
      <div class="panel stack">
        <div class="kicker">Delivery paused</div>
        <h2>ON HOLD</h2>
        <p class="muted" style="margin:0 0 .4em;font-style:italic">♫ ${esc(HOLD_MUSIC[Math.floor(Math.random() * HOLD_MUSIC.length)])}</p>
        <button class="btn primary" data-act="resume"><span>RESUME</span></button>
        <button class="btn" data-act="retry">RETRY <kbd>R</kbd></button>
        <button class="btn" data-act="garage">LOAD &amp; BUILD</button>
        <button class="btn" data-act="contracts">DISPATCH</button>
        <button class="btn" data-act="controls">CONTROLS</button>
        <button class="btn" data-act="settings">SETTINGS</button>
        <button class="btn ghost" data-act="title">BACK TO TITLE</button>
      </div>
    </div>`);
  bind(
    root,
    {
      resume: () => api.resume(),
      retry: () => api.retry(),
      garage: () => api.openGarage(),
      contracts: () => api.openContracts(),
      controls: () => api.openControls(() => api.resume()),
      settings: () => api.openSettings(() => api.resume()),
      title: () => api.toTitle(),
    },
    api,
  );
  return root;
}

export function controlsScreen(api: ScreenApi, back: () => void): HTMLElement {
  const root = h(`
    <div class="screen menu scrim">
      <div class="panel stack">
        <div class="kicker">How to deliver</div>
        <h2>CONTROLS</h2>
        <div class="controls-table">
          <span><kbd>W</kbd><kbd>↑</kbd></span><span>Gas. Also starts the clock.</span>
          <span><kbd>S</kbd><kbd>↓</kbd></span><span>Brake. Keep holding when stopped to reverse.</span>
          <span><kbd>A</kbd><kbd>←</kbd></span><span>NOSE UP in the air (lean back on the ground).</span>
          <span><kbd>D</kbd><kbd>→</kbd></span><span>NOSE DOWN in the air (lean forward on the ground).</span>
          <span><kbd>R</kbd></span><span>Instant retry. No questions asked.</span>
          <span><kbd>Esc</kbd></span><span>Pause.</span>
          <span>Pad</span><span>RT gas · LT brake · left stick nose up/down · hold LB+RB retry · Start pause</span>
        </div>
        <p class="muted">Deliver at least <b style="color:var(--paper)">3 of 5</b> parcels. Stop in the marked bay to deliver. Drive slowly past a fallen box to pick it back up.</p>
        <button class="btn" data-act="back">BACK</button>
      </div>
    </div>`);
  bind(root, { back }, api);
  return root;
}

function resultLine(r: RunResult, reward: Reward, pick: (event: string) => string | null, slowTime: number): string {
  if (!r.passed) {
    if (r.failReason === 'insufficient') return pick('failed_insufficient_cargo') ?? '';
    if (r.failReason === 'pool') return pick('failed_pool') ?? '';
    return pick('failed_crash') ?? '';
  }
  if (reward.personalBest) {
    const l = pick('new_personal_best');
    if (l) return l;
  }
  if (r.flamingo) return pick('passed_with_flamingo') ?? '';
  if (r.time > slowTime) return pick('slow_pass') ?? '';
  if (r.style >= 1200) return pick('stylish_pass') ?? '';
  if (r.delivered === 5) {
    if (r.stamps.allAccounted) return pick(r.route === 'safe' ? 'safe_route_clean_pass' : 'passed_all_five_clean') ?? '';
    return pick('passed_all_five_damaged') ?? '';
  }
  return pick(r.delivered === 4 ? 'passed_four' : 'passed_three') ?? '';
}

/** A fake customer review chosen from what actually happened. */
export function pickReview(r: RunResult, course: CourseSpec): { stars: number; text: string } | null {
  const conds: string[] = [];
  if (r.failReason === 'pool') conds.push('pool');
  else if (r.failReason && r.failReason !== 'insufficient') conds.push('crash');
  else if (r.failReason === 'insufficient') conds.push('insufficient');
  else {
    if (r.flamingo) conds.push('flamingo');
    if (r.stamps.allAccounted) conds.push('perfect');
    if (r.flips > 0) conds.push('flips');
    if (r.route === 'shortcut') conds.push('shortcut');
    if (r.recovered) conds.push('recovered');
    if (r.time > course.par.slow * 0.8) conds.push('slow');
    if (r.delivered === 5 && !r.stamps.allAccounted) conds.push('damaged');
    if (r.delivered === 4) conds.push('four');
    if (r.delivered === 3) conds.push('three');
  }
  for (const c of conds) {
    const pool = REVIEWS.filter((x) => x.when === c);
    if (pool.length) {
      const pick = pool[(r.attemptId.charCodeAt(r.attemptId.length - 2) + r.delivered) % pool.length];
      return { stars: pick.stars, text: pick.text.replace('{dest}', course.destination) };
    }
  }
  return null;
}

const SIGNERS = [
  'K. Desk (front desk, asleep)',
  'Somebody named “Big Tony”',
  'The pool guy, reluctantly',
  'A seagull (unverified)',
  'Receiving Dept. (a folding chair)',
  'Night Manager, day shift',
  'X (illegible, but confident)',
];

const FAIL_TEXT: Record<string, string> = {
  pool: 'Vehicle entered the pool',
  wipeout: 'Driver met the ground, helmet first',
  inverted: 'Vehicle stayed upside down',
  bounds: 'Left the delivery area',
  stuck: 'Vehicle got hung up',
  insufficient: 'Fewer than 3 parcels arrived',
};

export function resultsScreen(
  api: ScreenApi,
  r: RunResult,
  reward: Reward,
  course: CourseSpec,
  pickLine: (event: string) => string | null,
  extras: { photo?: { src: string; caption: string }; tracking: { t: number; text: string }[] } = { tracking: [] },
): { root: HTMLElement; joke: string } {
  const verdict = r.passed ? (r.delivered === 5 ? 'DELIVERED' : 'DELIVERED — MOSTLY') : 'DELIVERY INCOMPLETE';
  const sub = r.passed ? `${course.destination} · ${r.route === 'shortcut' ? 'Rooftop route' : 'Ground route'}` : FAIL_TEXT[r.failReason ?? ''] ?? '';
  const slots = r.parcels
    .filter((p) => p.required)
    .map(
      (p) => `<div class="slot ${p.delivered ? '' : 'no'}"><div class="b">${p.delivered ? '✔' : '✕'}</div>
      <div>${esc(p.label.replace('CARTON ', '#'))}</div><div class="cond"><i style="width:${p.delivered ? Math.round(p.condition * 100) : 0}%"></i></div></div>`,
    )
    .join('');
  const fl = r.parcels.find((p) => p.kind === 'flamingo');
  const s = r.score;
  const stamp = (k: 'delivered' | 'allAccounted' | 'express', label: string) =>
    `<div class="stamp ${r.stamps[k] ? 'on' : ''} ${reward.newStamps.includes(k) ? 'new' : ''}">${label}</div>`;
  const joke = resultLine(r, reward, pickLine, course.par.slow * 0.8);
  const ach = reward.newAchievements.map((a) => ACHIEVEMENTS[a]?.title).filter(Boolean);
  const review = pickReview(r, course);
  const signer = r.passed ? SIGNERS[(r.attemptId.charCodeAt(r.attemptId.length - 1) + r.delivered) % SIGNERS.length] : '';
  const polaroid = extras.photo
    ? `<figure class="polaroid ${r.passed ? '' : 'fail'}"><div class="tape"></div><img src="${extras.photo.src}" alt="${esc(extras.photo.caption)}"><figcaption>${esc(extras.photo.caption)}</figcaption></figure>`
    : '';
  const tracking = extras.tracking.length
    ? `<div class="tracking"><div class="th">TRACKING HISTORY</div>${extras.tracking
        .map((t) => `<div class="tr"><span>${fmtTime(t.t)}</span><span>${esc(t.text)}</span></div>`)
        .join('')}</div>`
    : '';
  const root = h(`
    <div class="screen results scrim">
      ${polaroid}
      <div class="receipt" role="dialog" aria-label="Delivery receipt">
        <img class="logo" src="${api.logoUrl}" alt="SlingMods">
        <div class="hdr">DELIVERY RECEIPT · ${esc(course.name.toUpperCase())} · #${r.attemptId.slice(-5).toUpperCase()}</div>
        <div class="verdict ${r.passed ? 'pass' : 'fail'}">${verdict}</div>
        <div class="verdict-sub">${esc(sub)}</div>
        <div class="row" style="justify-content:center;gap:.6em;font-size:1.3em">DELIVERED: <b>${r.delivered}/${r.required}</b>${fl ? `<span style="font-size:.8em">${fl.delivered ? '+ \u{1F9A9}' : ''}</span>` : ''}</div>
        <div class="slots">${slots}</div>
        <div class="rows">
          <div class="row"><span class="l">Time</span><span>${fmtTime(r.time)}${reward.personalBest ? '<span class="pb">PERSONAL BEST</span>' : ''}</span></div>
          ${
            r.passed
              ? `<div class="row"><span class="l">Parcels × 1,000</span><span>${s.delivery.toLocaleString()}</span></div>
          <div class="row"><span class="l">Condition</span><span>${s.condition.toLocaleString()}</span></div>
          <div class="row"><span class="l">Time bonus</span><span>${s.time.toLocaleString()}</span></div>
          <div class="row"><span class="l">Style</span><span>${s.style.toLocaleString()}</span></div>
          ${s.bonus ? `<div class="row"><span class="l">Flamingo (optional)</span><span>${s.bonus}</span></div>` : ''}
          <div class="row total"><span>TOTAL</span><span>${s.total.toLocaleString()}</span></div>`
              : `<div class="row"><span class="l">Style (not banked)</span><span>${r.style.toLocaleString()}</span></div>
          <div class="row total"><span>TOTAL</span><span>0</span></div>`
          }
        </div>
        <div class="stamps">${stamp('delivered', 'DELIVERED')}${stamp('allAccounted', 'ALL ACCOUNTED FOR')}${stamp('express', 'EXPRESS')}</div>
        <div class="credit-line"><span>Shop Credit earned</span><b>+${reward.credits}</b></div>
        ${ach.length ? `<div class="credit-line" style="margin-top:.4em;background:#f3c01c55"><span>Achievement</span><b>${esc(ach.join(', '))}</b></div>` : ''}
        ${tracking}
        ${signer ? `<div class="signed"><span>SIGNED FOR BY</span><b>${esc(signer)}</b></div>` : ''}
        ${review ? `<div class="review"><div class="stars" aria-label="${review.stars} of 5 stars">${'★'.repeat(review.stars)}<i>${'★'.repeat(5 - review.stars)}</i></div><q>${esc(review.text)}</q><cite>— Verified Recipient</cite></div>` : ''}
        <div class="joke">${esc(joke)}</div>
        <div class="fineprint">Fictional Shop Credit. Game use only. ${r.assist ? '· Auto-balance assist on' : ''}</div>
      </div>
      <div class="result-actions">
        <button class="btn primary" data-act="retry"><span>SEND IT AGAIN</span></button>
        <button class="btn" data-act="garage">LOAD &amp; BUILD</button>
        <button class="btn" data-act="contracts">DISPATCH</button>
      </div>
    </div>`);
  bind(root, { retry: () => api.retry(), garage: () => api.openGarage(), contracts: () => api.openContracts() }, api);
  return { root, joke };
}

const STRIPS: Record<string, string> = {
  sunset: 'linear-gradient(180deg,#f2b27a 0%,#ffd79a 55%,#2f8fb0 56%,#29c4d8 100%)',
  pier: 'linear-gradient(180deg,#9ccbe8 0%,#e9f1ea 55%,#9c7650 56%,#6b5038 100%)',
  hoa: 'linear-gradient(180deg,#a9d0ee 0%,#f5ecd8 55%,#6e9a45 56%,#4f7a2f 100%)',
};

export function contractsScreen(api: ScreenApi): HTMLElement {
  const cards = api.courses
    .map((c, i) => {
      const rec = api.save.records[c.id];
      const st = rec?.stamps;
      return `<button class="contract" data-course="${c.id}">
        <div class="strip" style="background:${STRIPS[c.id] ?? STRIPS.sunset}"></div>
        <div class="no">CONTRACT ${String(i + 1).padStart(2, '0')} · ${esc(c.district.toUpperCase())}</div>
        <h3>${esc(c.name)}</h3>
        <div class="dest">Deliver 3 of 5 to: <b>${esc(c.destination)}</b></div>
        <div class="note">“${esc(c.note)}”</div>
        <div class="mini-stamps"><span class="${st?.delivered ? 'on' : ''}">DELIVERED</span><span class="${st?.allAccounted ? 'on' : ''}">ALL ACCOUNTED</span><span class="${st?.express ? 'on' : ''}">EXPRESS ≤ ${c.par.express}s</span></div>
        <div class="best">${rec?.bestScore ? `PERSONAL BEST ${rec.bestScore.toLocaleString()} · ${rec.bestTime !== null ? fmtTime(rec.bestTime) : ''}` : 'No delivery on record. Yet.'}</div>
      </button>`;
    })
    .join('');
  const root = h(`
    <div class="screen menu scrim" style="flex-direction:column;gap:1.2em">
      <div style="text-align:center"><div class="kicker">Today’s manifest</div><h2 style="font-size:2.6em">DISPATCH</h2></div>
      <div class="contracts">${cards}</div>
      <div style="display:flex;gap:.8em"><button class="btn" data-act="garage">LOAD &amp; BUILD</button><button class="btn ghost" data-act="back">BACK</button></div>
    </div>`);
  root.querySelectorAll<HTMLElement>('[data-course]').forEach((b) =>
    b.addEventListener('click', () => {
      api.sfx('ui-select');
      api.startRun(b.dataset.course);
    }),
  );
  bind(root, { garage: () => api.openGarage(), back: () => api.toTitle() }, api);
  return root;
}

function stackPic(presetId: PresetId): string {
  const p = PRESETS[presetId];
  const rows: string[][] = [];
  let row: string[] = [];
  for (const id of p.order) {
    if (row.length >= p.maxPerRow) {
      rows.push(row);
      row = [];
    }
    row.push(id);
  }
  if (row.length) rows.push(row);
  const cls = (id: string) => {
    const c = CARGO.find((x) => x.id === id)!;
    return c.kind === 'heavy' ? 'h' : c.kind === 'fragile' ? 'f' : c.kind === 'flamingo' ? 'fl' : '';
  };
  return `<div class="stackpic">${rows.map((r) => `<div class="r">${r.map((id) => `<i class="${cls(id)}"></i>`).join('')}</div>`).join('')}</div>`;
}

export function garageScreen(api: ScreenApi, onChange: () => void): HTMLElement {
  const root = h(`<div class="screen garage"></div>`);
  const render = () => {
    const b = api.save.build;
    const v = VEHICLES[b.vehicle];
    const opt = (group: string, id: string, name: string, desc: string, cost: number, selected: boolean) => {
      const key = `${group}:${id}`;
      const owned = cost === 0 || api.owns(key);
      const afford = api.save.credits >= cost;
      return `<button class="opt ${selected ? 'sel' : ''} ${!owned && !afford ? 'locked' : ''}" data-group="${group}" data-id="${id}" data-cost="${cost}" aria-pressed="${selected}">
        <span class="nm">${esc(name)}</span><span class="ds">${esc(desc)}</span>${owned ? '' : `<span class="cost">${cost} credit</span>`}</button>`;
    };
    root.innerHTML = `
      <div class="side">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div class="kicker">Loading dock</div><h2>LOAD &amp; BUILD</h2></div>
          <div class="credits">${api.save.credits.toLocaleString()} <small>SHOP CREDIT</small></div>
        </div>
        <div class="section-label">VEHICLE</div>
        <div class="seg">${VEHICLE_ORDER.map((id) => `<button class="opt ${b.vehicle === id ? 'sel' : ''}" data-group="vehicle" data-id="${id}" data-cost="0" aria-pressed="${b.vehicle === id}"><span class="nm">${VEHICLES[id].name}</span></button>`).join('')}</div>
        <div class="veh-card"><div class="dept">${esc(v.department.toUpperCase())}</div><div class="line">“${esc(v.line)}”</div>
          <div class="traits">${v.traits.map((t) => `<span>${esc(t)}</span>`).join('')}<span style="color:var(--muted)">Arcade characteristics</span></div></div>
        <div class="section-label">LOAD ARRANGEMENT</div>
        <div class="seg">${PRESET_ORDER.map((id) => {
          const p = PRESETS[id];
          return `<button class="opt ${b.preset === id ? 'sel' : ''}" data-group="preset" data-id="${id}" data-cost="0" aria-pressed="${b.preset === id}"><span class="nm">${p.name}</span>${stackPic(id)}<span class="ds">${p.traits.join(' · ')}</span></button>`;
        }).join('')}</div>
        <div class="section-label">SUSPENSION</div>
        <div class="seg">${Object.entries(SUSPENSION).map(([id, s]) => opt('suspension', id, s.name, s.desc, s.cost, b.suspension === id)).join('')}</div>
        <div class="section-label">TIRES</div>
        <div class="seg">${Object.entries(TIRES).map(([id, s]) => opt('tires', id, s.name, s.desc, s.cost, b.tires === id)).join('')}</div>
        <div class="section-label">CARGO RESTRAINTS</div>
        <div class="seg">${Object.entries(RESTRAINTS).map(([id, s]) => opt('restraint', id, s.name, s.desc, s.cost, b.restraint === id)).join('')}</div>
        <div class="section-label">PAINT (COSMETIC)</div>
        <div class="seg">${PAINTS.map((p, i) => opt('paint', String(i), p.name, '', p.cost, b.paint === i)).join('')}</div>
        <div style="display:flex;gap:.6em;flex-wrap:wrap;margin-top:.4em">
          <button class="btn primary" data-act="go"><span>SEND IT</span></button>
          <button class="btn" data-act="bounce">BOUNCE TEST</button>
          <button class="btn ghost" data-act="back">DISPATCH</button>
        </div>
        <div class="disclaimer">Equipment names are fictional game items, not real products. Fictional arcade physics. Real-world riding rules still apply.</div>
      </div>`;
    root.querySelectorAll<HTMLElement>('.opt').forEach((el) =>
      el.addEventListener('click', () => {
        const group = el.dataset.group!;
        const id = el.dataset.id!;
        const cost = Number(el.dataset.cost);
        const key = `${group}:${id}`;
        if (cost > 0 && !api.owns(key)) {
          if (!api.buy(key, cost)) {
            api.sfx('ui-back');
            api.bark('broke');
            return;
          }
          api.bark('purchase');
        }
        api.sfx('ui-select');
        if (group === 'vehicle') {
          if (api.save.build.vehicle !== id) api.bark('veh_' + id);
          api.setBuild({ vehicle: id as VehicleId });
        } else if (group === 'preset') {
          if (api.save.build.preset !== id) api.bark('preset_' + id);
          api.setBuild({ preset: id as PresetId });
        }
        else if (group === 'suspension') api.setBuild({ suspension: id as Build['suspension'] });
        else if (group === 'tires') api.setBuild({ tires: id as Build['tires'] });
        else if (group === 'restraint') api.setBuild({ restraint: id as Build['restraint'] });
        else if (group === 'paint') api.setBuild({ paint: Number(id) });
        onChange();
        const focusKey = `[data-group="${group}"][data-id="${id}"]`;
        render();
        (root.querySelector(focusKey) as HTMLElement | null)?.focus();
      }),
    );
    bind(root, { go: () => api.startRun(), bounce: () => api.bounceTest(), back: () => api.openContracts() }, api);
  };
  render();
  return root;
}

export function settingsScreen(api: ScreenApi, back: () => void): HTMLElement {
  const root = h(`<div class="screen menu scrim"><div class="panel stack"></div></div>`);
  const panel = root.querySelector('.panel')!;
  const render = () => {
    const s = api.save.settings;
    const slider = (k: keyof Settings, label: string, min = 0, max = 1, step = 0.05) =>
      `<label class="setting"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-k="${k}"></label>`;
    const tog = (k: keyof Settings, label: string) =>
      `<div class="setting"><span>${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-t="${k}" aria-pressed="${!!s[k]}">${s[k] ? 'ON' : 'OFF'}</button></div>`;
    panel.innerHTML = `
      <div class="kicker">Preferences</div><h2>SETTINGS</h2>
      ${slider('master', 'Master volume')}
      ${slider('music', 'Music')}
      ${slider('sfx', 'Effects')}
      ${slider('voice', 'Dispatch radio (voice)')}
      ${tog('muted', 'Mute everything')}
      ${tog('reducedMotion', 'Reduced motion')}
      ${tog('shake', 'Camera shake')}
      ${tog('autoBalance', 'Auto-balance assist (recorded with results)')}
      ${slider('uiScale', 'Interface size', 0.8, 1.4, 0.05)}
      <div class="setting"><span>Graphics</span><button class="toggle on" data-q="1">${s.quality === 'high' ? 'HIGH' : 'LOW'}</button></div>
      <div class="setting"><span>Touch controls</span><button class="toggle on" data-tc="1">${s.touchControls.toUpperCase()}</button></div>
      <div class="muted" style="font-size:.85em">Progress is saved in this browser only. ${api.save.credits.toLocaleString()} Shop Credit · ${api.save.stats.deliveries} deliveries · ${api.save.stats.pools} pool incidents.</div>
      <button class="btn" data-act="back">BACK</button>`;
    panel.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((i) =>
      i.addEventListener('input', () => api.applySettings({ [i.dataset.k!]: Number(i.value) } as Partial<Settings>)),
    );
    panel.querySelectorAll<HTMLElement>('[data-t]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.t as keyof Settings;
        api.applySettings({ [k]: !api.save.settings[k] } as Partial<Settings>);
        api.sfx('ui-select');
        render();
        (panel.querySelector(`[data-t="${k}"]`) as HTMLElement)?.focus();
      }),
    );
    panel.querySelector('[data-q]')!.addEventListener('click', () => {
      api.applySettings({ quality: api.save.settings.quality === 'high' ? 'low' : 'high' });
      render();
    });
    panel.querySelector('[data-tc]')!.addEventListener('click', () => {
      const order: Settings['touchControls'][] = ['auto', 'on', 'off'];
      api.applySettings({ touchControls: order[(order.indexOf(api.save.settings.touchControls) + 1) % 3] });
      render();
    });
    bind(panel as HTMLElement, { back }, api);
  };
  render();
  return root;
}

export function touchControls(
  onChange: (key: 'throttle' | 'brake' | 'up' | 'down', down: boolean) => void,
  onAction: (a: 'trick' | 'toss') => void = () => {},
): HTMLElement {
  const root = h(`
    <div class="touch">
      <div class="grp"><div class="tpad" data-k="up">▲<small>NOSE UP</small></div><div class="tpad" data-k="down">▼<small>NOSE DOWN</small></div></div>
      <div class="grp col"><div class="tpad mini trick" data-a="trick">★<small>TRICK</small></div><div class="tpad mini" data-a="toss">⬆<small>TOSS</small></div></div>
      <div class="grp"><div class="tpad" data-k="brake">■<small>BRAKE</small></div><div class="tpad big gas" data-k="throttle">▶<small>GAS</small></div></div>
    </div>`);
  root.querySelectorAll<HTMLElement>('[data-a]').forEach((pad) => {
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.classList.add('on');
      onAction(pad.dataset.a as 'trick' | 'toss');
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) pad.addEventListener(ev, () => pad.classList.remove('on'));
  });
  // Each pad tracks its own set of pointer ids so multi-touch works and
  // cancellation always releases.
  root.querySelectorAll<HTMLElement>('.tpad[data-k]').forEach((pad) => {
    const ids = new Set<number>();
    const k = pad.dataset.k as 'throttle' | 'brake' | 'up' | 'down';
    const update = () => {
      pad.classList.toggle('on', ids.size > 0);
      onChange(k, ids.size > 0);
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      ids.add(e.pointerId);
      update();
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      pad.addEventListener(ev, (e) => {
        ids.delete((e as PointerEvent).pointerId);
        update();
      });
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  return root;
}

export function toast(title: string, text: string, ms = 3200): HTMLElement {
  const t = h(`<div class="toast passthru"><b></b><span></span></div>`);
  t.querySelector('b')!.textContent = title;
  t.querySelector('span')!.textContent = text;
  setTimeout(() => t.remove(), ms);
  return t;
}
