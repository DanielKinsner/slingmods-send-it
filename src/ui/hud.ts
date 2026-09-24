import type { Run } from '../game/run';
import type { StuntAward } from '../game/stunts';
import { MIN_TO_PASS, REQUIRED_COUNT } from '../data/cargo';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

/** In-run heads-up display. Updates DOM only when values change. */
export class Hud {
  readonly root = el('div', 'hud');
  private timer = el('div', 'hud-chip timer');
  private parcels = el('div', 'hud-chip parcels');
  private boxes: HTMLElement[] = [];
  private label = el('div', 'parcel-label');
  private style = el('div', 'hud-chip style-chip');
  private styleVal = el('span', 'val', '0');
  private pending = el('span', 'pending');
  private promptEl: HTMLElement | null = null;
  private promptTimer = 0;
  private dispatchEl: HTMLElement | null = null;
  private dispatchTimer = 0;
  private stuntEl: HTMLElement | null = null;
  private bannerEl: HTMLElement | null = null;
  private pickupEl = el('div', 'pickup-tag hidden', 'PICKING UP');
  private speedLines = el('div', 'speed-lines');
  readonly pauseBtn = el('button', 'icon-btn hud-pause', '❚❚');
  private last = { time: '', label: '', style: -1, pending: -1, boxes: '' };

  constructor() {
    const top = el('div', 'hud-top');
    this.timer.innerHTML = '<div><small>TIME</small><span>0:00.00</span></div>';
    const row = el('div', 'parcel-row');
    for (let i = 0; i < REQUIRED_COUNT + 1; i++) {
      const b = el('div', 'pbox');
      this.boxes.push(b);
      row.appendChild(b);
    }
    this.parcels.append(row, this.label);
    this.style.append(this.styleVal, el('small', '', 'STYLE'), this.pending);
    top.append(el('div').appendChild(this.timer).parentElement!, this.parcels, this.style);
    this.pauseBtn.setAttribute('aria-label', 'Pause');
    this.root.append(this.speedLines, top, this.pickupEl, this.pauseBtn);
  }

  reset() {
    this.clearPrompt();
    this.dispatchEl?.remove();
    this.dispatchEl = null;
    this.stuntEl?.remove();
    this.stuntEl = null;
    this.bannerEl?.remove();
    this.bannerEl = null;
    this.last = { time: '', label: '', style: -1, pending: -1, boxes: '' };
  }

  update(run: Run, dt: number, toScreen: (x: number, y: number) => [number, number]) {
    const t = fmtTime(run.time);
    if (t !== this.last.time) {
      this.timer.querySelector('span')!.textContent = t;
      this.last.time = t;
    }
    // Parcel icons (required first, flamingo last).
    const items = [...run.cargo.items].sort((a, b) => Number(b.spec.required) - Number(a.spec.required));
    const sig = items.map((i) => `${i.state}${i.condition < 0.6 ? 'd' : ''}${i.pickup ? 'p' : ''}`).join(',');
    if (sig !== this.last.boxes) {
      this.last.boxes = sig;
      items.forEach((it, i) => {
        const b = this.boxes[i];
        if (!b) return;
        const kind = it.spec.kind;
        const state = it.pickup ? 'onboard' : it.state;
        b.className = `pbox ${kind} ${state === 'onboard' || state === 'delivered' ? '' : state} ${it.condition < 0.6 ? 'damaged' : ''}`;
        b.textContent = kind === 'flamingo' ? '🦩' : '';
        b.title = `${it.spec.label}: ${state}`;
      });
    }
    const c = run.cargo.counts();
    const onboard = c.onboard;
    const warn = onboard < MIN_TO_PASS || c.lost > REQUIRED_COUNT - MIN_TO_PASS;
    const label = `ON BOARD <b>${onboard}/${REQUIRED_COUNT}</b> · NEED ${MIN_TO_PASS}${c.loose ? ` · <b style="color:var(--yellow)">${c.loose} LOOSE</b>` : ''}`;
    if (label !== this.last.label) {
      this.label.innerHTML = label;
      this.label.classList.toggle('warn', warn);
      this.last.label = label;
    }
    const style = run.stunts.banked;
    if (style !== this.last.style) {
      this.styleVal.textContent = style.toLocaleString();
      this.last.style = style;
    }
    const pend = run.stunts.pendingTotal;
    if (pend !== this.last.pending) {
      this.pending.textContent = pend ? `+${pend} PENDING` : '';
      this.last.pending = pend;
    }
    // Pickup tag follows the parcel being recovered.
    const pk = run.cargo.items.find((i) => i.pickup);
    if (pk) {
      const [sx, sy] = toScreen(pk.pos.x, pk.pos.y);
      this.pickupEl.style.left = `${sx}px`;
      this.pickupEl.style.top = `${sy}px`;
      this.pickupEl.classList.remove('hidden');
    } else this.pickupEl.classList.add('hidden');
    this.speedLines.style.opacity = String(Math.max(0, Math.min(0.9, (run.vehicle.speed - 15) / 10)));

    if (this.promptEl) {
      this.promptTimer -= dt;
      if (this.promptTimer <= 0) this.clearPrompt();
    }
    if (this.dispatchEl) {
      this.dispatchTimer -= dt;
      if (this.dispatchTimer <= 0) {
        this.dispatchEl.remove();
        this.dispatchEl = null;
      }
    }
  }

  prompt(html: string, seconds = 4, urgent = false) {
    this.clearPrompt();
    const p = el('div', `prompt passthru${urgent ? ' urgent' : ''}`, html);
    this.root.appendChild(p);
    this.promptEl = p;
    this.promptTimer = seconds;
  }

  clearPrompt() {
    this.promptEl?.remove();
    this.promptEl = null;
  }

  dispatch(text: string, seconds = 4.5) {
    this.dispatchEl?.remove();
    const d = el('div', 'dispatch passthru', `<div class="radio">\u{1F4FB}</div><div><div class="who">DISPATCH</div><div class="what"></div></div>`);
    d.querySelector('.what')!.textContent = text;
    this.root.appendChild(d);
    this.dispatchEl = d;
    this.dispatchTimer = seconds;
  }

  stunt(awards: StuntAward[], total: number, dropped = false) {
    this.stuntEl?.remove();
    const top = awards.reduce((a, b) => (b.points > a.points ? b : a), awards[0]);
    const s = el('div', `stunt-pop passthru${dropped ? ' dropped' : ''}`);
    s.innerHTML = `<div class="big"></div><div class="pts"></div>`;
    s.querySelector('.big')!.textContent = dropped ? 'STUNT LOST' : awards.length > 1 ? awards.map((a) => a.label).slice(0, 3).join(' + ') : top.label;
    s.querySelector('.pts')!.textContent = dropped ? `-${total}` : `+${total.toLocaleString()}`;
    this.root.appendChild(s);
    this.stuntEl = s;
    setTimeout(() => {
      if (this.stuntEl === s) {
        s.remove();
        this.stuntEl = null;
      }
    }, 1700);
  }

  /** Quick mid-air trick callout; stacks upward for combos. */
  trickCall(label: string, points: number, chain: number) {
    const el = document.createElement('div');
    el.className = 'trick-call passthru';
    el.style.setProperty('--n', String(Math.min(chain, 5)));
    el.innerHTML = `<b></b><span></span>`;
    el.querySelector('b')!.textContent = chain > 1 ? `${label} ×${chain}` : label;
    el.querySelector('span')!.textContent = `+${points}`;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  banner(text: string, sub = '', good = false, ms = 1800) {
    this.bannerEl?.remove();
    const b = el('div', `banner passthru${good ? ' good' : ''}`);
    b.textContent = text;
    if (sub) {
      const s = el('small');
      s.textContent = sub;
      b.appendChild(s);
    }
    this.root.appendChild(b);
    this.bannerEl = b;
    setTimeout(() => {
      if (this.bannerEl === b) {
        b.remove();
        this.bannerEl = null;
      }
    }, ms);
  }
}
