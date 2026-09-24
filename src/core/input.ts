import type { InputState } from '../sim/types';

export type Action = 'retry' | 'pause' | 'confirm' | 'back' | 'up' | 'down' | 'left' | 'right' | 'horn' | 'trick' | 'toss';

/**
 * Keyboard, gamepad and touch merged into one InputState. Releasing focus,
 * hiding the tab or disconnecting a pad always releases every control.
 */
export class Input {
  private keys = new Set<string>();
  private touch = { throttle: false, brake: false, up: false, down: false };
  private listeners: ((a: Action) => void)[] = [];
  private padPrev: boolean[] = [];
  private retryHold = 0;
  lastDevice: 'keyboard' | 'pad' | 'touch' = 'keyboard';

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      this.lastDevice = 'keyboard';
      if (!e.repeat) {
        if (k === 'KeyR') this.fire('retry');
        if (k === 'Escape' || k === 'KeyP') this.fire('pause');
        if (k === 'Enter' || k === 'Space') this.fire('confirm');
        if (k === 'Backspace') this.fire('back');
        if (k === 'KeyH') this.fire('horn');
        if (k === 'Space' || k === 'KeyJ') this.fire('trick');
        if (k === 'KeyE' || k === 'KeyK') this.fire('toss');
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    const releaseAll = () => this.releaseAll();
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll();
    });
    window.addEventListener('gamepaddisconnected', releaseAll);
  }

  releaseAll() {
    this.keys.clear();
    this.touch = { throttle: false, brake: false, up: false, down: false };
    this.retryHold = 0;
  }

  on(fn: (a: Action) => void) {
    this.listeners.push(fn);
  }

  private fire(a: Action) {
    for (const l of this.listeners) l(a);
  }

  /** Direction held when a trick is pressed: gas = up, brake = down, pitch = side. */
  trickDir(): 'none' | 'up' | 'down' | 'side' {
    const k = this.keys;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g && g.connected);
    const ay = p?.axes[1] ?? 0;
    const ax = p?.axes[0] ?? 0;
    if (k.has('KeyW') || k.has('ArrowUp') || this.touch.throttle || ay < -0.5) return 'up';
    if (k.has('KeyS') || k.has('ArrowDown') || this.touch.brake || ay > 0.5) return 'down';
    if (k.has('KeyA') || k.has('KeyD') || k.has('ArrowLeft') || k.has('ArrowRight') || this.touch.up || this.touch.down || Math.abs(ax) > 0.5) return 'side';
    return 'none';
  }

  fireAction(a: Action) {
    this.fire(a);
  }

  setTouch(key: keyof Input['touch'], down: boolean) {
    this.touch[key] = down;
    this.lastDevice = 'touch';
  }

  /** Poll once per frame for gamepad buttons (edge-triggered actions). */
  pollPad(dt: number) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g && g.connected);
    if (!p) return;
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i: number) => b[i] && !this.padPrev[i];
    if (b.some(Boolean) || p.axes.some((a) => Math.abs(a) > 0.4)) this.lastDevice = 'pad';
    if (edge(9)) this.fire('pause'); // Start/Menu
    if (edge(0)) this.fire('confirm'); // A
    if (edge(1)) {
      this.fire('back'); // B (menus)
      this.fire('toss'); // B (in a run)
    }
    if (edge(2)) this.fire('trick'); // X
    if (edge(3)) this.fire('retry'); // Y (menus/results)
    if (edge(12)) this.fire('up');
    if (edge(13)) this.fire('down');
    if (edge(14)) this.fire('left');
    if (edge(15)) this.fire('right');
    // In-run restart: hold both shoulder buttons for 0.6 s (prevents accidents).
    if (b[4] && b[5]) {
      this.retryHold += dt;
      if (this.retryHold > 0.6) {
        this.retryHold = -10;
        this.fire('retry');
      }
    } else this.retryHold = 0;
    this.padPrev = b;
  }

  state(): InputState {
    const k = this.keys;
    let throttle = k.has('KeyW') || k.has('ArrowUp') || this.touch.throttle ? 1 : 0;
    let brake = k.has('KeyS') || k.has('ArrowDown') || this.touch.brake ? 1 : 0;
    let pitch = 0;
    if (k.has('KeyA') || k.has('ArrowLeft') || this.touch.up) pitch += 1;
    if (k.has('KeyD') || k.has('ArrowRight') || this.touch.down) pitch -= 1;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g && g.connected);
    if (p) {
      const rt = p.buttons[7]?.value ?? 0;
      const lt = p.buttons[6]?.value ?? 0;
      throttle = Math.max(throttle, rt > 0.05 ? rt : 0);
      brake = Math.max(brake, lt > 0.05 ? lt : 0);
      const ax = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.18) pitch = Math.max(-1, Math.min(1, pitch - ax)); // left = nose up
    }
    return { throttle, brake, pitch };
  }
}
